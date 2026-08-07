import React from "react";
import { ThemeMode, useTheme } from "../context/ThemeContext";

function formatFileSize(bytes?: number): string {
	if (bytes == null || Number.isNaN(bytes)) {
		return "Unknown size";
	}

	if (bytes === 0) return "0 B";

	const units = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));

	return `${(bytes / Math.pow(1024, i)).toFixed(i == 0 ? 0 : 1)} ${units[i]}`;
}

interface Props {
	isIncoming: boolean;
	filename: string;
	filesize: number;
	timestamp: string;
	downloadUrl: string;
	status: "sending" | "sent" | "failed";
	progress?: number;
}

const MessageDisplay = ({
	isIncoming,
	filename,
	filesize,
	timestamp,
	downloadUrl,
	status,
	progress,
}: Props) => {
	const { theme } = useTheme();

	return (
		<div className="d-flex w-100 justify-content-center">
			<div
				className={`d-flex flex-row justify-content-between align-items-center mb-3 p-3 rounded-3 gap-4 shadow ${!isIncoming && "bg-primary text-white"}`}
				style={{
					width: "300px",
					backgroundColor: isIncoming ? theme.messageBackground : "",
					marginLeft: !isIncoming ? "350px" : "",
					marginRight: isIncoming ? "350px" : "",
				}}
			>
				<div className="d-flex flex-column" style={{ minWidth: 0 }}>
					<h6
						className="mt-0"
						style={{
							overflowWrap: "break-word",
							wordBreak: "break-word",
						}}
					>
						{filename}
					</h6>
					<p className="mb-0">{formatFileSize(filesize)}</p>
					<p className="mb-0">
						{status == "failed"
							? "Failed to send"
							: status == "sent"
								? timestamp
								: ""}
					</p>
					{status == "sending" && (
						<svg
							width="200"
							height="20"
							viewBox="-2 -2 404 20"
							xmlns="http://www.w3.org/2000/svg"
						>
							<rect
								width="400"
								height="20"
								rx="10"
								ry="10"
								fill="none"
								stroke={isIncoming ? theme.text : "white"}
								strokeWidth="3"
							/>

							<rect
								//Clamp the progress bar at both ends
								width={
									Math.min(Math.max(progress ?? 0, 0.04), 1) *
									400
								}
								height="20"
								rx="10"
								ry="10"
								fill={isIncoming ? theme.text : "white"}
								stroke={isIncoming ? theme.text : "white"}
								strokeWidth="3"
							/>
						</svg>
					)}
				</div>
				{downloadUrl && (
					<a href={downloadUrl} download={filename} className="m-2">
						<img
							style={{ width: "20px" }}
							src={
								isIncoming
									? "../src/icons/download-blue.png"
									: "../src/icons/download-white.png"
							}
						/>
					</a>
				)}
			</div>
		</div>
	);
};

export default MessageDisplay;
