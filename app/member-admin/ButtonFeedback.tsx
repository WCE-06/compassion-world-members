"use client";
import {useEffect} from "react";

export function ButtonFeedback(){
 useEffect(()=>{
  const clicked=(event:MouseEvent)=>{const button=(event.target as HTMLElement|null)?.closest<HTMLButtonElement>(".member-admin-page button");if(!button||button.disabled)return;button.classList.remove("staff-button-accepted");void button.offsetWidth;button.classList.add("staff-button-accepted");window.setTimeout(()=>button.classList.remove("staff-button-accepted"),650)};
  document.addEventListener("click",clicked,true);
  return()=>document.removeEventListener("click",clicked,true);
 },[]);
 return null;
}
