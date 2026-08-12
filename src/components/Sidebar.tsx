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
	isMobileUI?: boolean;
}

const Sidebar = ({
	clients,
	name,
	onSelectClient,
	togglePairing,
	editName,
	deleteClient,
	toggleSettings,
	isMobileUI,
}: Props) => {
	const [deselect, setDeselect] = useState(0);

	return (
		<div
			className="d-flex flex-column align-items-start justify-content-start border-end pb-0 rounded-0 h-100"
			style={{
				width: isMobileUI ? "100%" : "300px",
				padding: isMobileUI ? "24px" : "16px",
				containerType: "inline-size",
			}}
		>
			<PairingButton
				togglePairing={togglePairing}
				onPairingMenu={() => {
					setDeselect((prev) => prev + 1);
				}}
				isMobileUI={isMobileUI}
			/>
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
