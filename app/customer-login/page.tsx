import AuthForm from "@/components/AuthForm";

export default function CustomerLoginPage() {
  return (
    <main className="auth-page auth-entry-page">
      <header className="auth-brand-bar">HopToDrop</header>
      <section className="auth-entry-card">
        <AuthForm role="customer" redirectPath="/client/dashboard" />
      </section>
    </main>
  );
}
