import "./globals.css";

export const metadata = {
  title: "Jam III · Nomination tracker",
  description:
    "Look up your s&box Game Jam III nominations, leaderboard position, and distance to the top five.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
