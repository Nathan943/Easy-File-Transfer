import React, { useState } from "react";

interface Props {
	togglePairing: () => void;
	onPairingMenu: () => void;
	isMobileUI?: boolean;
}

const PairingButton = ({ togglePairing, onPairingMenu, isMobileUI }: Props) => {
	return (
		<button
			type="button"
			className="btn btn-outline-primary rounded-3 w-100"
			style={{
				fontSize: "clamp(16px, 6cqw, 36px)",
				padding: "3cqw",
				marginBottom: "8cqw",
				fontWeight: 600,
			}}
			onClick={() => {
				togglePairing();
				onPairingMenu();
			}}
		>
			Add device
		</button>
	);
};

export default PairingButton;
