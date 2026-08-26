const formatter=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"});

export function jstDateInput(date=new Date()){
 const parts=Object.fromEntries(formatter.formatToParts(date).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}

export function jstMonthInput(date=new Date()){return jstDateInput(date).slice(0,7)}
