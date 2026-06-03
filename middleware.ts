import { NextRequest, NextResponse } from "next/server";

const driverHost = "driver.hoptodrop.com";
const mainHost = "hoptodrop.com";
const mainWwwHost = "www.hoptodrop.com";
const productionHosts = new Set([mainHost, mainWwwHost, "hoptodrop.vercel.app"]);

function isAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/icon.svg" ||
    pathname === "/maskable-icon.svg" ||
    pathname === "/driver-icon.svg" ||
    pathname === "/offline.html"
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

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hostname = request.nextUrl.hostname.toLowerCase();

  if (isAsset(pathname) || isLocalHost(hostname)) return NextResponse.next();

  if (hostname === driverHost) {
    if (pathname === "/") {
      const rewrite = request.nextUrl.clone();
      rewrite.pathname = "/driver";
      return NextResponse.rewrite(rewrite);
    }

    if (pathname === "/driver") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/";
      return NextResponse.redirect(redirect);
    }

    if (pathname === "/driver-login") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.searchParams.set("role", "driver");
      return NextResponse.redirect(redirect);
    }

    if (pathname === "/login" && searchParams.get("role") !== "driver") {
      const redirect = request.nextUrl.clone();
      redirect.searchParams.set("role", "driver");
      return NextResponse.redirect(redirect);
    }

    if (pathname.startsWith("/customer-login") || pathname.startsWith("/rider-login") || pathname.startsWith("/client") || pathname.startsWith("/rider")) {
      return NextResponse.redirect(mainUrl(request));
    }

    return NextResponse.next();
  }

  if (productionHosts.has(hostname)) {
    if (pathname === "/driver-login") {
      const redirect = driverUrl(request, "/login");
      redirect.searchParams.set("role", "driver");
      return NextResponse.redirect(redirect);
    }

    if (pathname.startsWith("/driver") || (pathname === "/login" && searchParams.get("role") === "driver")) {
      return NextResponse.redirect(driverUrl(request));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/manifest.webmanifest", "/sw.js", "/icon.svg", "/maskable-icon.svg", "/driver-icon.svg"]
};
