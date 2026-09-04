import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

interface Theme {
	background: string;
	text: string;
	border: string;
	hover: string;
	selected: string;
	messageBackground: string;
	settingsPopupBackground: string;
}

const lightTheme: Theme = {
	background: "#ffffff",
	text: "#212529",
	border: "#ced4da",
	hover: "#cfcfcf",
	selected: "#e6e6e6",
	messageBackground: "#d3d4d5",
	settingsPopupBackground: "#e6e6e6",
};

const darkTheme: Theme = {
	background: "#212529",
	text: "#f8f9fa",
	border: "#495057",
	hover: "#5d6366",
	selected: "#2f3133",
	messageBackground: "#424649",
	settingsPopupBackground: "#424649",
};

interface ThemeContextType {
	theme: Theme;
	themeMode: ThemeMode;
	setThemeMode: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
	const [themeMode, setThemeMode] = useState<ThemeMode>(
		(localStorage.getItem("theme") as ThemeMode) ?? "light",
	);

	useEffect(() => {
		localStorage.setItem("theme", themeMode);

		if (themeMode == "dark") {
			document.documentElement.setAttribute("data-bs-theme", "dark");
		} else {
			document.documentElement.setAttribute("data-bs-theme", "light");
		}
	}, [themeMode]);

	const theme = themeMode == "dark" ? darkTheme : lightTheme;

	return (
		<ThemeContext.Provider value={{ theme, themeMode, setThemeMode }}>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = () => {
	const context = useContext(ThemeContext);

	if (!context) {
		throw new Error("useTheme must be used inside ThemeProvider");
	}

	return context;
};
