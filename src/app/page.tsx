
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/ide');
  return null; // Or a loading spinner, but redirect is usually fast enough
}
