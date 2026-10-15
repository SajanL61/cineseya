import { WifiOff } from 'lucide-react';
import Link from 'next/link';
export const metadata = { title: 'Offline', robots: { index: false, follow: false } };
export default function OfflinePage(){return <div className="error-page"><WifiOff/><span>Offline</span><h1>You are between signals</h1><p>Previously loaded metadata may still be available. Media files are never cached automatically.</p><Link className="action-button" href="/">Try the app shell</Link></div>}
