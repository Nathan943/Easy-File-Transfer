/*
    Client application for the file transfer system
*/

import { Client, TemporaryFile, QueuedUpload } from "../types/types";
import cryptoHandler from "./CryptoHandler";
import { useSettings } from "../context/SettingsContext";
import notificationSound from "../sounds/notification.mp3";

//Files are sent in chunks of CHUNK_SIZE
const CHUNK_SIZE = 512 * 1024;

//Handle everything to do with the connection to the server and other clients
class SocketHandler {
	//WebSocket connection
	private socket: WebSocket | null = null;

	//This client's id
	private clientId = "";

	//Stores the client a file is being sent from
	private currentClient: Client | null = null;
	private incomingFile: TemporaryFile | null = null;
	private currentMessageId: string | undefined;
	private incomingIv: string | null = null;

	//Files are put into a queue when sending to another client
	private uploadQueue: QueuedUpload[] = [];
	private uploading: boolean = false;

	private autoDownload = false;
	private soundOnDownload = false;

	private downloadSound = new Audio(notificationSound);

	/*
	Callback functions so App can receive data
	*/
	private onPairCodeReceivedCallback?: (code: number) => void;
	private onNameReceivedCallback?: (
		name: string,
		isPrimaryTab: boolean,
	) => void;
	private onClientConnectedCallback?: (client: Client) => void;
	private onFileReceivedCallback?: (
		client: Client,
		file: File,
		messageId: string,
	) => void;
	private onContactsReceivedCallback?: (contacts: Client[]) => void;
	private onClientOnlineStatusChangeCallback?: (
		targetClientId: string,
		online: boolean,
	) => void;
	private onClientRemovedCallback?: (clientId: string) => void;
	private onNameChangedCallback?: (
		targetClientId: string,
		name: string,
	) => void;
	private onFileSentCallback?: (messageId: string) => void;
	private onFileFailedCallback?: (messageId: string) => void;
	private onMetaReceivedCallback?: (
		client: Client,
		file: TemporaryFile,
		messageId: string,
	) => void;
	private updateProgressBarCallback?: (
		messageId: string,
		progress: number,
	) => void;

	//Initialize WebSocket connection
	connect(clientId: string) {
		this.socket = new WebSocket("ws://localhost:8080");
		this.clientId = clientId;

		//Connect to the server and tell it that this client is online
		this.socket.addEventListener("open", async () => {
			console.log("CONNECTED");
			this.socket?.send(
				JSON.stringify({
					signal: "ON_CLIENT_CONNECT",
					targetClientId: this.clientId,
					publicKey: await cryptoHandler.exportPublicKey(),
				}),
			);
		});

		//Listen for messages from the server
		this.socket.addEventListener("message", async (msg) => {
			//Check for raw file data first
			if (typeof msg.data !== "string") {
				if (!this.incomingFile) return;

				this.incomingFile.chunks.push(msg.data);

				if (!this.currentMessageId) return;

				const progress =
					(this.incomingFile.chunks.length * CHUNK_SIZE) /
					this.incomingFile.size;
				this.updateProgressBarCallback?.(
					this.currentMessageId,
					progress,
				);

				return;
			}

			//If not raw file data, parse the JSON message
			const parsedMessage = JSON.parse(msg.data);

			/*
			Decide what to do with the message
			*/
			switch (parsedMessage.signal) {
				case "PAIRING_CODE":
					//Display pairing code in App
					const pairingCode = parsedMessage.pairingCode;
					this.onPairCodeReceivedCallback?.(pairingCode);
					break;
				case "CLIENT_NAME":
					//Display name in App
					this.onNameReceivedCallback?.(
						parsedMessage.name,
						parsedMessage.isPrimaryTab,
					);
					break;

				case "CLIENT_NAME_CHANGED":
					//Change name for a contact in App
					this.onNameChangedCallback?.(
						parsedMessage.clientId,
						parsedMessage.name,
					);
					break;

				case "CONTACT_LIST":
					//Display connected clients in App
					this.onContactsReceivedCallback?.(parsedMessage.contacts);
					break;

				case "CLIENT_STATUS_CHANGE":
					if (
						parsedMessage.clientId == this.currentClient?.id &&
						parsedMessage.online == false &&
						this.currentMessageId
					) {
						this.uploading = false;
						this.onFileFailedCallback?.(this.currentMessageId);
						this.processQueue();
					}

					//Change online status for a client in App
					this.onClientOnlineStatusChangeCallback?.(
						parsedMessage.clientId,
						parsedMessage.online,
					);
					break;

				case "CONNECTED_CLIENT_INFO":
					//Add new contact in App

					//If no name or id was sent, do nothing (usually means pairing failed)
					if (parsedMessage.clientId == null) break;

					//Log connected client
					const newClient: Client = {
						id: parsedMessage.clientId,
						name: parsedMessage.clientName,
						online: true,
					};

					this.onClientConnectedCallback?.(newClient);
					break;

				case "CLIENT_REMOVED":
					if (parsedMessage.clientId == this.currentClient?.id) {
						this.currentClient = null;
					}

					this.onClientRemovedCallback?.(parsedMessage.clientId);

					break;

				case "PUBLIC_KEY":
					const isTrusted = await cryptoHandler.checkKey(
						parsedMessage.targetClientId,
						parsedMessage.publicKey,
					);

					if (!isTrusted) {
						console.error("Warning: Public key changed");
						return;
					}

					await cryptoHandler.importPublicKey(
						parsedMessage.publicKey,
						parsedMessage.targetClientId,
					);
					break;

				case "FILE_META":
					console.log("meta received");
					//Don't log new metadata if a file is still being sent
					if (this.incomingFile) break;

					//Log client
					this.currentClient = parsedMessage.client;

					//Log metadata
					this.incomingFile = {
						name: parsedMessage.name,
						type: parsedMessage.type,
						size: parsedMessage.size,
						chunks: [],
					};
					this.incomingIv = parsedMessage.iv;

					if (!this.currentClient) break;
					if (!this.incomingFile) break;

					this.onMetaReceivedCallback?.(
						this.currentClient,
						this.incomingFile,
						parsedMessage.messageId,
					);

					this.currentMessageId = parsedMessage.messageId;
					break;

				case "FILE_END":
					//Reconstruct a file now that all information has been sent, and send the file to App
					if (!this.incomingFile) break;
					if (!this.currentClient) break;
					if (!this.incomingIv) break;

					const reconstructedBlob = new Blob(
						this.incomingFile.chunks,
						{
							type: this.incomingFile.type,
						},
					);

					const reconstructedFile = new File(
						[reconstructedBlob],
						this.incomingFile.name,
						{ type: this.incomingFile.type },
					);

					const decryptedFile = await cryptoHandler.decryptFile(
						reconstructedFile,
						this.incomingIv,
						this.currentClient.id,
					);

					this.onFileReceivedCallback?.(
						this.currentClient,
						decryptedFile,
						parsedMessage.messageId,
					);

					//Check if the automatic download settings is enabled, and if so download a copy immediately
					if (this.autoDownload) {
						const url = URL.createObjectURL(decryptedFile);

						const a = document.createElement("a");
						a.href = url;
						a.download = decryptedFile.name;
						a.style.display = "none";

						document.body.appendChild(a);
						a.click();
						document.body.removeChild(a);

						setTimeout(() => URL.revokeObjectURL(url), 1000);
					}

					this.updateProgressBarCallback?.(
						parsedMessage.messageId,
						1,
					);

					if (this.soundOnDownload) {
						this.playDownloadSound();
					}

					this.incomingFile = null;
					this.currentClient = null;
					this.currentMessageId = undefined;
					this.incomingIv = null;

					break;

				case "FILE_FAILED":
					this.uploading = false;
					this.onFileFailedCallback?.(parsedMessage.messageId);
					this.processQueue();
					break;
				case "FILE_SENT":
					this.uploading = false;
					this.onFileSentCallback?.(parsedMessage.messageId);
					this.processQueue();
					break;
			}
		});

		//Listen for connection close
		this.socket.addEventListener("close", () => {
			console.log("DISCONNECTED");
		});

		//Listen for connection error
		this.socket.addEventListener("error", () => {
			console.log("ERROR");
		});
	}

	//Close the socket connection
	disconnect() {
		this.socket?.close();
	}

	//Request pairing code from server
	getPairingCode = () => {
		this.socket?.send(
			JSON.stringify({
				signal: "REQUEST_PAIRING_CODE",
			}),
		);
	};

	//Request name change
	editName = (name: string) => {
		this.socket?.send(
			JSON.stringify({
				signal: "CHANGE_NAME",
				name: name,
			}),
		);
	};

	//Ask server to connect with another client
	connectWithClient = (pairingCode: string) => {
		this.socket?.send(
			JSON.stringify({
				signal: "CONNECT_WITH_CLIENT",
				pairingCode: pairingCode,
			}),
		);
	};

	deleteClient(clientId: string) {
		this.socket?.send(
			JSON.stringify({
				signal: "REMOVE_CLIENT",
				clientId: clientId,
			}),
		);
	}

	playDownloadSound() {
		console.log("sound played");
		this.downloadSound.volume = 0.5;
		this.downloadSound.currentTime = 0;
		this.downloadSound.play().catch(() => {
			"not played";
		});
	}

	//Start the process of sending a file to the server
	async send(file: File, targetClient: Client, messageId: string) {
		if (!file) return;
		if (!targetClient) return;

		const encryptedData = await cryptoHandler.encryptFile(
			file,
			targetClient.id,
		);

		// const url = URL.createObjectURL(encryptedData.file);

		// const a = document.createElement("a");
		// a.href = url;
		// a.download = "encrypted.bin";
		// a.click();

		// URL.revokeObjectURL(url);

		//Add file to a queue
		this.uploadQueue.push({
			file: encryptedData.file,
			iv: encryptedData.iv,
			targetClient,
			messageId,
		});
		console.log("upload added to queue");

		//Process queue one file at a time
		this.processQueue();
	}

	//Process the file queue
	private processQueue() {
		if (this.uploading) return;
		if (this.uploadQueue.length == 0) return;

		//Get next file in line and send it
		const uploadData = this.uploadQueue.shift();
		if (!uploadData) return;

		this.uploading = true;

		this.sendFile(uploadData);
	}

	//Send file in chunks
	private sendFile(uploadData: QueuedUpload) {
		console.log("file sending");

		//Keep track of how much of the file has been sent
		let counter = 0;

		const file = uploadData.file;

		//Send metadata first
		this.socket?.send(
			JSON.stringify({
				signal: "FILE_META",
				iv: uploadData.iv,
				name: file.name,
				type: file.type,
				size: file.size,
				targetClientId: uploadData.targetClient.id,
				messageId: uploadData.messageId,
			}),
		);

		const sendChunk = () => {
			//If the connection to the server closes stop uploading
			if (!this.socket || this.socket.readyState != WebSocket.OPEN) {
				this.uploading = false;
				return;
			}

			if (this.uploading == false) return;

			//Loop through every full chunk and send it
			//Then send the last partial chunk
			if (counter + CHUNK_SIZE < file.size) {
				//Get chunk and send
				console.log("chunk sent");

				const chunk = file.slice(counter, counter + CHUNK_SIZE);
				this.socket?.send(chunk);

				counter += CHUNK_SIZE;

				const progress = counter / file.size;
				this.updateProgressBarCallback?.(
					uploadData.messageId,
					progress,
				);

				setTimeout(sendChunk, 0);
			} else {
				//Send the last chunk, which is not a full 128kb
				const last = file.slice(counter, file.size);
				this.socket?.send(last);
				console.log("finished");

				//Send end signal
				this.socket?.send(
					JSON.stringify({
						signal: "FILE_END",
						messageId: uploadData.messageId,
					}),
				);
			}
		};

		sendChunk();
	}

	setAutoDownload(value: boolean) {
		this.autoDownload = value;
	}

	setSoundOnDownload(value: boolean) {
		this.soundOnDownload = value;
	}

	/*
	More callback function stuff so App can receive data
	*/
	onPairCodeReceived(callback: (code: number) => void) {
		this.onPairCodeReceivedCallback = callback;
	}

	onNameReceived(callback: (name: string, isPrimaryTab: boolean) => void) {
		this.onNameReceivedCallback = callback;
	}

	onClientConnected(callback: (client: Client) => void) {
		this.onClientConnectedCallback = callback;
	}

	onFileReceived(
		callback: (client: Client, file: File, messageId: string) => void,
	) {
		this.onFileReceivedCallback = callback;
	}

	onClientRemoved(callback: (clientId: string) => void) {
		this.onClientRemovedCallback = callback;
	}

	onNameChanged(callback: (targetClientId: string, name: string) => void) {
		this.onNameChangedCallback = callback;
	}

	onContactsReceived(callback: (contacts: Client[]) => void) {
		this.onContactsReceivedCallback = callback;
	}

	onClientOnlineStatusChange(
		callback: (targetClientId: string, online: boolean) => void,
	) {
		this.onClientOnlineStatusChangeCallback = callback;
	}

	onFileSent(callback: (messageId: string) => void) {
		this.onFileSentCallback = callback;
	}

	onFileFailed(callback: (messageId: string) => void) {
		this.onFileFailedCallback = callback;
	}

	onMetaReceived(
		callback: (
			client: Client,
			file: TemporaryFile,
			messageId: string,
		) => void,
	) {
		this.onMetaReceivedCallback = callback;
	}

	updateProgressBar(callback: (messageId: string, progress: number) => void) {
		this.updateProgressBarCallback = callback;
	}
}

export default new SocketHandler();
