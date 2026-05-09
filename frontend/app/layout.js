import "./globals.css";

export const metadata = {
  title: "EduClub LMS",
  description: "Co-curricular learning management system"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
