import {redirect} from 'react-router';
import {requireDashboardPreview} from '../lib/recovered-dashboard.server';
// Canonical operational dashboard; historical bookmarks must not open browser samples.
export function loader(){requireDashboardPreview();return redirect('/preview/database',{headers:{'Cache-Control':'no-store'}});}
export function headers(){return {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};}
export default function DashboardRedirect(){return null;}
