import { AppProviders } from "./providers/AppProviders";
import { AuthProvider } from "./providers/AuthProvider";
import { ThemeProvider } from "./providers/ThemeProvider";
import { AppRouter } from "./router/routes";

export function App() {
  return (
    <AppProviders>
      <AuthProvider>
        <ThemeProvider>
          <AppRouter />
        </ThemeProvider>
      </AuthProvider>
    </AppProviders>
  );
}
