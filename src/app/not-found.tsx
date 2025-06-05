
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6 text-center">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      {/* 
        The user requested to change an h2 element with specific styles:
        Original HTML: <h2 style="font-size:14px;font-weight:400;line-height:49px;margin:0">
        The text content was "This page could not be found."
        The new text content requested is "Getting 404 error".
        Tailwind equivalent for the style: text-sm (14px), font-normal (weight 400), leading-[49px] (line-height 49px), m-0 (margin 0).
      */}
      <h2 className="text-sm font-normal leading-[49px] m-0">
        Getting 404 error
      </h2>
      <p className="text-lg text-muted-foreground mt-2 mb-8">
        Sorry, the page you are looking for does not exist.
      </p>
      <Link 
        href="/ide" 
        className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90"
      >
        Go to IDE
      </Link>
    </div>
  );
}
