import {bookingReviewEnabled,BOOKING_REVIEW_STAFF} from '../lib/booking-review.server';
import {useState} from 'react';
import {Link,redirect,useLoaderData} from 'react-router';
import type {LoaderFunctionArgs} from 'react-router';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {getAuth,getDatabase,authUnavailable} from '../lib/auth.server';
import {resolveStaff} from '../lib/staff-reads.server';
import {readWizardData} from '../lib/wizard-database.server';
import {requireDashboardPreview} from '../lib/recovered-dashboard.server';
import {DispatchBookingWizard} from '../../src/components/Trips/TripModal/DispatchBookingWizard';
import './dashboard.css';import './book.css';
export async function loader({request}:LoaderFunctionArgs){
 requireDashboardPreview();
 const review=bookingReviewEnabled();
 if(!review&&!request.headers.get('Cookie')?.includes('car_session='))return redirect('/account/signin');
 try{const staff=review?BOOKING_REVIEW_STAFF:await resolveStaff(getDatabase(),await getAuth().getUser(request));
 const services=await readWizardData(getDatabase(),staff,'services');const drivers=await readWizardData(getDatabase(),staff,'drivers');const vehicles=await readWizardData(getDatabase(),staff,'vehicles');
 return {services,drivers,vehicleCount:vehicles.length};
 }catch(error){if(error instanceof Response)throw error;throw authUnavailable(error);}
}
export function headers(){return {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};}
export default function DatabaseBook(){const {drivers,services,vehicleCount}=useLoaderData<typeof loader>();const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false}}}));
 return <main className="original-booking-preview"><aside className="original-booking-warning"><strong>TEST DATABASE · LIMITED BOOKING WRITE · Temporary Vercel-gated review expires 03:14 UTC</strong><span>Existing passenger, one-way, service lines, no payment method, no specific vehicle; Save Without Sending only. Unsupported populated fields are rejected. No emails/texts/charges. {vehicleCount} database vehicles available. {!vehicleCount&&'Vehicle selection cannot proceed until test vehicles are added.'}</span><Link to="/preview/database">Back to database dashboard</Link></aside><QueryClientProvider client={client}><DispatchBookingWizard drivers={drivers} services={services} clients={[]} onClose={()=>{window.location.href='/preview/database';}} onSuccess={()=>{window.location.href='/preview/database';}} /></QueryClientProvider></main>;
}
