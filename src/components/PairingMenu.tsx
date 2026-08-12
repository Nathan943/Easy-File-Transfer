import React, { ChangeEvent, useState } from "react";

interface Props {
	pairingCode: number;
	generatePairingCode: () => void;
	connectWithClient: (pairingCode: string) => void;
	isMobileUI?: boolean;
}

const PairingMenu = ({
	pairingCode,
	generatePairingCode,
	connectWithClient,
	isMobileUI,
}: Props) => {
	const [inputCode, setInputCode] = useState("");

	const handleInputCode = (event: ChangeEvent<HTMLInputElement>) => {
		setInputCode(event.target.value);
	};

	return (
		<div
			className="d-flex flex-column my-auto justify-content-center"
			style={{
				width: "clamp(200px, 70cqw, 250px)",
				transform: isMobileUI ? "scale(1.15)" : "",
			}}
		>
			<h4 className="mb-3">Add device</h4>

			<button
				type="button"
				className="btn btn-outline-primary mb-4 p-2"
				onClick={generatePairingCode}
			>
				Generate pairing code
			</button>

			{pairingCode != 0 && (
				<>
					<h1
						className="text-center mb-3"
						style={{
							letterSpacing: "8px",
							fontWeight: "bold",
						}}
					>
						{pairingCode}
					</h1>
					<p className="text-center text-secondary">
						Expires in 10 minutes
					</p>
				</>
			)}

			<div className="text-center text-muted mb-2">OR</div>

			<input
				type="number"
				value={inputCode}
				onChange={handleInputCode}
				className="form-control mb-2"
				placeholder="Enter code..."
			/>

			<button
				className="btn btn-success p-2"
				onClick={() => {
					connectWithClient(inputCode);
				}}
			>
				Connect
			</button>
		</div>
	);
};

export default PairingMenu;
