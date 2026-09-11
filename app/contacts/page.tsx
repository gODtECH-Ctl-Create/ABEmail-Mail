import { redirect } from 'next/navigation';

export default function ContactsRoute() {
  redirect('/?view=contacts');
}
