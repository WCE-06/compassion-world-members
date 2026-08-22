export const TERMS_VERSION="2026-08-22";
export const PRIVACY_VERSION="2026-08-22";
export const digits=(value:string)=>value.replace(/\D/g,"");
export type RegistrationInput={displayName:string;phone:string;birthDate:string;postalCode:string;address:string;email:string;acceptedTerms:boolean};
export function validateRegistration(value:Record<string,unknown>|null){
 const displayName=typeof value?.displayName==="string"?value.displayName.trim().replace(/\s+/g," ").slice(0,120):"";
 const phone=digits(typeof value?.phone==="string"?value.phone:"");
 const birthDate=typeof value?.birthDate==="string"?value.birthDate.trim():"";
 const postalCode=digits(typeof value?.postalCode==="string"?value.postalCode:"");
 const address=typeof value?.address==="string"?value.address.trim().replace(/\s+/g," ").slice(0,240):"";
 const email=typeof value?.email==="string"?value.email.trim().toLowerCase().slice(0,160):"";
 const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
 const date=parts?new Date(Date.UTC(Number(parts[1]),Number(parts[2])-1,Number(parts[3]))):null;
 const validDate=Boolean(date&&!Number.isNaN(date.getTime())&&date!.getUTCFullYear()===Number(parts?.[1])&&date!.getUTCMonth()===Number(parts?.[2])-1&&date!.getUTCDate()===Number(parts?.[3])&&date!.getTime()<=Date.now());
 const errors:string[]=[];
 if(displayName.length<1)errors.push("DISPLAY_NAME_REQUIRED");
 if(phone.length<10||phone.length>11)errors.push("PHONE_INVALID");
 if(!validDate)errors.push("BIRTH_DATE_INVALID");
 if(postalCode.length!==7)errors.push("POSTAL_CODE_INVALID");
 if(address.length<4)errors.push("ADDRESS_INVALID");
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))errors.push("EMAIL_INVALID");
 if(value?.acceptedTerms!==true)errors.push("TERMS_REQUIRED");
 return{ok:errors.length===0,errors,data:{displayName,phone,birthDate,postalCode,address,email,acceptedTerms:value?.acceptedTerms===true}};
}
