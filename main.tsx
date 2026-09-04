import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.css";
import App from "./src/App";
import { ThemeProvider } from "./src/context/ThemeContext";
import { SettingsProvider } from "./src/context/SettingsContext";

createRoot(document.getElementById("root")!).render(
	<ThemeProvider>
		<SettingsProvider>
			<App />
		</SettingsProvider>
	</ThemeProvider>,
);
