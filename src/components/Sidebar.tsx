import React, { use, useState } from "react";
import Name from "./Name";
import ClientList from "./ClientList";
import PairingButton from "./PairingButton";
import { Client } from "../types/types";
import SettingsPopup from "./SettingsPopup";
import { useTheme } from "../context/ThemeContext";

interface Props {
	clients: Client[];
	name: string;
	editName: (name: string) => void;
	onSelectClient: (client: Client) => void;
	togglePairing: () => void;
	toggleSettings: () => void;
	deleteClient: (client: Client) => void;
}

const Sidebar = ({
	clients,
	name,
	onSelectClient,
	togglePairing,
	editName,
	deleteClient,
	toggleSettings,
}: Props) => {
	const [deselect, setDeselect] = useState(0);

	return (
		<div
			className="d-flex flex-column align-items-start justify-content-start p-0 border-end rounded-0 vh-100"
			style={{
				width: "300px",
			}}
		>
			<div className="w-100 p-3 pb-4">
				<PairingButton
					togglePairing={togglePairing}
					onPairingMenu={() => {
						setDeselect((prev) => prev + 1);
					}}
				/>
			</div>
			<ClientList
				clients={clients}
				onSelectClient={onSelectClient}
				deselect={deselect}
				deleteClient={deleteClient}
			/>
			<div className="w-100">
				<SettingsPopup
					name={name}
					editName={editName}
					toggleSettings={toggleSettings}
					onSettingsMenu={() => {
						setDeselect((prev) => prev + 1);
					}}
				/>
			</div>
		</div>
	);
};

export default Sidebar;
