"use client";

import React, {useState,useEffect} from "react";
import { useQuery } from "@tanstack/react-query";
import CalendarAtAGlance from "@/components/CalendarAtAGlance";
import { ArrowLeft } from "lucide-react";

export default function CalendarGlancePage({initialDate}) {
 const [month,setMonth]=useState(()=>new Date(initialDate+'T12:00:00'));
 const key=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}`;
 const {data,isLoading,error}=useQuery({queryKey:['database-calendar-month',key],queryFn:async()=>{
  const response=await fetch('/preview/schedule-api?month='+encodeURIComponent(key),{credentials:'same-origin'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Month failed to load');return data;
 },retry:false});
 useEffect(()=>{const url=new URL(window.location.href);url.searchParams.set('date',key+'-01');window.history.replaceState(null,'',url);},[key]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(to right, #fef9f0, #e8f4fd)" }}
    >
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Back to Dashboard */}
        <a
          href="/preview/database"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 mb-5 no-underline"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </a>

        {error?<p role="alert">{error.message} — counts are not available.</p>:null}
        {isLoading?<p role="status">Loading calendar counts…</p>:null}
        <CalendarAtAGlance trips={data?.trips||[]} currentMonth={month} onMonthChange={setMonth} countsReady={!isLoading&&!error} />
      </div>
    </div>
  );
}
