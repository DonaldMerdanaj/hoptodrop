import AuthForm from "@/components/AuthForm";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";

export default function CustomerLoginPage() {
  return (
    <main className="auth-page">
      <TopNav />
      <section className="auth-card wide-card">
        <div>
          <div className="eyebrow">Rider app</div>
          <h1>Manage live rides</h1>
          <p>Track assigned drivers, fare estimates, payment method, and ride status.</p>
        </div>
        <AuthForm role="customer" redirectPath="/client/dashboard" />
      </section>
      <BottomNav />
    </main>
  );
}
