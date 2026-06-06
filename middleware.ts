import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";

const driverHost = "driver.hoptodrop.com";
const mainHost = "hoptodrop.com";
const mainWwwHost = "www.hoptodrop.com";
const productionHosts = new Set([mainHost, mainWwwHost, "hoptodrop.vercel.app"]);
type AppRole = "customer" | "driver" | "admin";

function isAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    /\.(ico|png|jpg|jpeg|svg|webmanifest|js|html)$/i.test(pathname)
  );
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function driverUrl(request: NextRequest, pathname = request.nextUrl.pathname) {
  const next = request.nextUrl.clone();
  next.protocol = "https";
  next.hostname = driverHost;
  next.pathname = pathname;
  return next;
}

function mainUrl(request: NextRequest, pathname = request.nextUrl.pathname) {
  const next = request.nextUrl.clone();
  next.protocol = "https";
  next.hostname = mainHost;
  next.pathname = pathname;
  return next;
}

function cleanDriverPath(pathname: string) {
  if (pathname === "/driver") return "/";
  if (pathname === "/driver-login") return "/login";
  if (pathname === "/driver/login") return "/login";
  if (pathname === "/driver/application" || pathname === "/driver/formaplication") return "/application";
  if (pathname === "/driver/dashboard") return "/dashboard";
  if (pathname.startsWith("/driver/")) return pathname.replace(/^\/driver/, "") || "/";
  return pathname;
}

function internalDriverPath(pathname: string) {
  if (pathname === "/" || pathname === "/dashboard") return "/driver";
  if (pathname === "/login") return "/driver/login";
  if (pathname === "/application") return "/driver/application";
  return pathname;
}

function isDriverCleanPath(pathname: string) {
  return pathname === "/" || pathname === "/dashboard" || pathname === "/login" || pathname === "/application";
}

function isRiderProtectedPath(pathname: string) {
  return pathname.startsWith("/rider/dashboard") || pathname.startsWith("/client") || pathname === "/dashboard";
}

async function getSessionRole(request: NextRequest, response: NextResponse) {
  // fix: middleware role checks use Supabase auth cookies plus profiles.role, never browser localStorage.
  const supabase = createMiddlewareClient({ req: request, res: response });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { session: null, role: null };

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  const role = data?.role;
  return {
    session,
    role: role === "customer" || role === "driver" || role === "admin" ? role : null
  };
}

async function enforceRole(request: NextRequest, response: NextResponse, internalPathname: string) {
  const hostname = request.nextUrl.hostname.toLowerCase();
  const { session, role } = await getSessionRole(request, response);

  if (hostname === driverHost && internalPathname.startsWith("/driver")) {
    if (internalPathname === "/driver/login") return response;
    if (!session?.user) {
      // fix: Supabase browser sessions are client-side here; let the driver app load and route to dashboard/application.
      return response;
    }
    if (role !== "driver" && role !== "admin") {
      // fix: driver.hoptodrop.com never redirects to the rider/main domain; wrong sessions stay in driver login.
      return NextResponse.redirect(driverUrl(request, "/login"));
    }
  }

  if (productionHosts.has(hostname) && isRiderProtectedPath(request.nextUrl.pathname)) {
    if (!session?.user) {
      // fix: Supabase browser auth is stored client-side here, so let rider pages load and enforce auth in the client guard.
      return response;
    }
    if (role === "driver") return NextResponse.redirect(driverUrl(request, "/"));
    if (role === "admin") {
      const next = request.nextUrl.clone();
      next.pathname = "/admin";
      return NextResponse.redirect(next);
    }
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hostname = request.nextUrl.hostname.toLowerCase();

  if (pathname === "/manifest.webmanifest") {
    const manifest = request.nextUrl.clone();
    manifest.pathname = hostname === driverHost ? "/driver-manifest.webmanifest" : "/rider-manifest.webmanifest";
    return NextResponse.rewrite(manifest);
  }

  if (isAsset(pathname) || isLocalHost(hostname)) return NextResponse.next();

  // Pass 1: Domain isolation. Driver domain keeps clean URLs while targeting app/driver internally.
  if (hostname === driverHost) {
    if (pathname.startsWith("/driver")) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = cleanDriverPath(pathname);
      return NextResponse.redirect(redirect);
    }

    if (pathname.startsWith("/customer-login") || pathname.startsWith("/rider-login") || pathname.startsWith("/rider/login") || pathname.startsWith("/client") || pathname.startsWith("/rider")) {
      // fix: any rider-style URL on driver.hoptodrop.com stays on the driver domain.
      return NextResponse.redirect(driverUrl(request, "/login"));
    }

    if (isDriverCleanPath(pathname)) {
      const rewrite = request.nextUrl.clone();
      rewrite.pathname = internalDriverPath(pathname);
      rewrite.searchParams.delete("role");
      const response = NextResponse.rewrite(rewrite);
      // Pass 2: role enforcement when Supabase middleware cookies can identify the user.
      return enforceRole(request, response, rewrite.pathname);
    }

    return enforceRole(request, NextResponse.next(), pathname);
  }

  if (productionHosts.has(hostname)) {
    if (pathname.startsWith("/driver")) {
      return NextResponse.redirect(driverUrl(request, cleanDriverPath(pathname)));
    }

    if (pathname === "/login" && searchParams.get("role") === "driver") return NextResponse.redirect(driverUrl(request, "/login"));

    return enforceRole(request, NextResponse.next(), pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/manifest.webmanifest", "/sw.js", "/icon.svg", "/maskable-icon.svg", "/driver-icon.svg"]
};
