import { createContext, useContext, useEffect, useState } from "react";

interface SettingsContextType {
	saveFiles: boolean;
	setSaveFiles: (saveFiles: boolean) => void;
	autoDownload: boolean;
	setAutoDownload: (autoDownload: boolean) => void;
	soundOnDownload: boolean;
	setSoundOnDownload: (soundOnDownload: boolean) => void;
	showOffline: boolean | true;
	setShowOffline: (showOffline: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
	undefined,
);

export const SettingsProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [saveFiles, setSaveFiles] = useState<boolean>(
		() => localStorage.getItem("saveFiles") != "false",
	);

	const [autoDownload, setAutoDownload] = useState<boolean>(
		() => localStorage.getItem("autoDownload") == "true",
	);

	const [soundOnDownload, setSoundOnDownload] = useState<boolean>(
		() => localStorage.getItem("soundOnDownload") == "true",
	);

	const [showOffline, setShowOffline] = useState<boolean>(
		() => localStorage.getItem("showOffline") != "false",
	);

	useEffect(() => {
		localStorage.setItem("saveFiles", String(saveFiles));
	}, [saveFiles]);

	useEffect(() => {
		localStorage.setItem("autoDownload", String(autoDownload));
	}, [autoDownload]);

	useEffect(() => {
		localStorage.setItem("soundOnDownload", String(soundOnDownload));
	}, [soundOnDownload]);

	useEffect(() => {
		localStorage.setItem("showOffline", String(showOffline));
	}, [showOffline]);

	return (
		<SettingsContext.Provider
			value={{
				saveFiles,
				setSaveFiles,
				autoDownload,
				setAutoDownload,
				soundOnDownload,
				setSoundOnDownload,
				showOffline,
				setShowOffline,
			}}
		>
			{children}
		</SettingsContext.Provider>
	);
};

export const useSettings = () => {
	const context = useContext(SettingsContext);

	if (!context) {
		throw new Error("Issue with SettingsContext");
	}

	return context;
};
