import { NextResponse } from 'next/server';


export function middleware(request) {
  const path = request.nextUrl.pathname;
  
  if (path === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 