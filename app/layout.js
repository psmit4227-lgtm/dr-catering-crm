import "./globals.css";

export const metadata = {
  title: "DR Catering CRM",
  description: "Order management system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
