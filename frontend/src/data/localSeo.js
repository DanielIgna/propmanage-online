// Local SEO hubs — general PropManage service hubs per locality (Cluj area).
// Distinct from design-interior local pages. Each hub covers ALL PropManage
// services for the locality with UNIQUE, non-templated content (no doorway pages).
// Primary CTA -> free account (/register). Secondary CTA -> /devino-specialist.

const CTA_PRIMARY = { label: "Evaluează-ți casa gratuit", to: "/register" };

// Shared platform services (same product everywhere). Differentiation lives in
// localContext / housingTypes / ownerNeeds / specialistsIntro / faq per locality.
const SERVICES = [
  {
    title: "Evaluarea gratuită a locuinței",
    body: "Afli starea reală a casei tale printr-o evaluare structurată — instalații, structură, izolație, documente — direct din contul gratuit.",
    to: "/register",
    linkLabel: "Creează cont și evaluează",
  },
  {
    title: "Scorul Casei (House Health)",
    body: "Un scor care măsoară sănătatea locuinței și îți arată ce merită rezolvat întâi. Crește pe măsură ce faci lucrări și revizii.",
    to: "/scorul-casei",
    linkLabel: "Vezi cum funcționează Scorul Casei",
  },
  {
    title: "Cartea Casei",
    body: "Istoricul digital al locuinței: documente, lucrări, revizii și garanții, într-un singur loc. Util la mentenanță, garanții și vânzare.",
    to: "/cartea-casei",
    linkLabel: "Despre Cartea Casei",
  },
  {
    title: "Digital Twin",
    body: "Un geamăn digital al proprietății care leagă starea, documentele și lucrările de o reprezentare fidelă a locuinței.",
    to: "/digital-twin",
    linkLabel: "Despre Digital Twin",
  },
  {
    title: "Imobile Verificate",
    body: "Dacă vinzi sau cumperi, starea verificată a casei devine o dovadă pentru cumpărător — nu doar o promisiune.",
    to: "/imobile-verificate",
    linkLabel: "Vezi Imobile Verificate",
  },
  {
    title: "Probleme frecvente ale casei",
    body: "Ghiduri practice despre infiltrații, mucegai, fisuri și umezeală — cum le recunoști și cum le rezolvi cu specialiști verificați.",
    to: "/probleme-casa",
    linkLabel: "Vezi problemele frecvente",
  },
];

export const LOCAL_HUBS = {
  "cluj-napoca": {
    slug: "cluj-napoca",
    city: "Cluj-Napoca",
    county: "județul Cluj",
    path: "/servicii-pentru-casa/cluj-napoca",
    badge: "Cluj-Napoca",
    title: "Servicii pentru casă în Cluj-Napoca: evaluare, verificare și specialiști | PropManage",
    description: "Servicii pentru locuință în Cluj-Napoca: evaluare gratuită, Scorul Casei, Cartea Casei, Digital Twin și specialiști verificați pentru apartamente și case. Cont gratuit.",
    h1: "Servicii pentru casă în Cluj-Napoca",
    intro: "Ești proprietar în Cluj-Napoca? PropManage îți aduce într-un singur loc evaluarea gratuită a locuinței, istoricul casei și accesul la specialiști verificați — fie că ai un apartament în Mănăștur, o casă în Andrei Mureșanu sau o garsonieră de închiriat lângă universitate.",
    localContext: [
      "Cluj-Napoca are unul dintre cele mai scumpe și mai dinamice fonduri locative din România. Cartiere precum Mănăștur, Mărăști și Gheorgheni concentrează mii de apartamente construite în anii '60–'80, cu instalații electrice și sanitare care ajung la finalul duratei de viață și au nevoie de înlocuire înainte de finisaje.",
      "În paralel, zone ca Bună Ziua, Sopor sau Borhanci adaugă constant ansambluri noi, iar cartierele de case — Andrei Mureșanu, Grigorescu, Zorilor — cer mentenanță periodică. Într-o piață atât de scumpă, o decizie greșită la cumpărare sau o lucrare prost executată costă enorm, de aceea proprietarii clujeni caută transparență și specialiști verificați.",
    ],
    housingTypes: [
      "Apartamente în blocuri vechi (Mănăștur, Mărăști, Gheorgheni) — instalații de înlocuit",
      "Apartamente noi în ansambluri (Bună Ziua, Sopor, Borhanci) — finisare și amenajare",
      "Case în cartiere rezidențiale (Andrei Mureșanu, Grigorescu, Zorilor)",
      "Garsoniere și apartamente pentru închiriere către studenți sau angajați IT",
    ],
    ownerNeeds: [
      "Verificarea tehnică înainte de cumpărare, într-o piață cu prețuri mari",
      "Înlocuirea instalațiilor electrice și sanitare vechi din blocurile comuniste",
      "Izolare termică și certificat energetic pentru reducerea facturilor",
      "Mentenanță și reparații rapide pentru apartamentele date în chirie",
      "Pregătirea documentelor și a stării casei pentru o vânzare avantajoasă",
    ],
    specialistsIntro: "În Cluj-Napoca găsești pe PropManage electricieni, instalatori, constructori, zugravi, montatori de gresie și faianță, auditori energetici și specialiști HVAC. Postezi cererea, primești oferte de la specialiști verificați din zonă, compari profiluri și recenzii, iar plata e protejată prin escrow.",
    faq: [
      { q: "Ce servicii PropManage sunt disponibile în Cluj-Napoca?", a: "Evaluarea gratuită a locuinței, Scorul Casei, Cartea Casei, Digital Twin, programul Imobile Verificate și accesul la specialiști verificați din Cluj pentru orice tip de lucrare." },
      { q: "Cât costă evaluarea locuinței?", a: "Contul de proprietar și evaluarea de bază sunt gratuite. Plătești doar serviciile pe care le comanzi (audit detaliat, lucrări), cu plată protejată prin escrow." },
      { q: "Pot verifica un apartament înainte să îl cumpăr în Cluj?", a: "Da. Într-o piață scumpă ca cea din Cluj, o verificare tehnică îți arată problemele reale (instalații, umezeală, structură) înainte să semnezi, prin programul Imobile Verificate și un audit al locuinței." },
      { q: "Cum găsesc un specialist de încredere în Cluj-Napoca?", a: "Postezi cererea în cont, iar specialiștii verificați din zonă îți trimit oferte. Compari profiluri, portofolii și recenzii reale înainte să alegi." },
    ],
  },

  "floresti": {
    slug: "floresti",
    city: "Florești",
    county: "județul Cluj",
    path: "/servicii-pentru-casa/floresti",
    badge: "Florești",
    title: "Servicii pentru casă în Florești: finisare, verificare și specialiști | PropManage",
    description: "Servicii pentru locuință în Florești: evaluare gratuită, verificarea calității apartamentelor noi, Cartea Casei, Digital Twin și specialiști verificați. Cont gratuit.",
    h1: "Servicii pentru casă în Florești",
    intro: "Ai cumpărat un apartament într-un ansamblu nou din Florești? PropManage te ajută să verifici calitatea construcției, să îți finisezi și amenajezi locuința cu specialiști verificați și să ții totul organizat — dintr-un cont gratuit.",
    localContext: [
      "Florești este cea mai mare comună din România ca populație, crescută exploziv datorită apropierii de Cluj-Napoca. Aici s-au ridicat mii de apartamente noi într-un ritm foarte rapid, iar populația e formată în mare parte din tineri și familii care fac naveta zilnic spre Cluj.",
      "Ritmul accelerat al construcțiilor înseamnă că multe apartamente se predau la gri sau semifinisate și că apar frecvent întrebări despre calitatea execuției — finisaje, umezeală, izolație fonică între apartamente. Proprietarii ocupați au nevoie de finisare și amenajare la cheie, făcute corect de la prima încercare.",
    ],
    housingTypes: [
      "Apartamente noi în ansambluri rezidențiale, predate la gri sau semifinisate",
      "Apartamente gata de finisat, care au nevoie de gresie, faianță, zugrăveli și mobilier",
      "Case noi și duplexuri în zonele rezidențiale ale comunei",
      "Apartamente cumpărate ca investiție, pentru închiriere către navetiști",
    ],
    ownerNeeds: [
      "Finisarea completă a apartamentelor noi predate la gri",
      "Verificarea calității construcției ridicate rapid (finisaje, izolație, umezeală)",
      "Amenajare la cheie pentru proprietari ocupați, care fac naveta la Cluj",
      "Mobilier pe comandă pentru apartamente compacte",
      "Organizarea documentelor și garanțiilor pentru un apartament nou",
    ],
    specialistsIntro: "Pentru un apartament nou în Florești ai nevoie de instalatori, electricieni, montatori de gresie și faianță, zugravi și tâmplari pentru mobilier pe comandă. Pe PropManage postezi cererea, primești oferte de la specialiști verificați din zona Cluj-Florești și lucrezi cu plata protejată prin escrow, pe etape.",
    faq: [
      { q: "Pot verifica calitatea unui apartament nou în Florești?", a: "Da. Construcțiile ridicate rapid pot avea probleme de finisaj, izolație sau umezeală. O evaluare a locuinței îți arată starea reală înainte să finisezi sau să te muți." },
      { q: "Cum finisez un apartament predat la gri?", a: "Postezi cererea în contul gratuit, iar specialiștii verificați (instalatori, electricieni, montatori, zugravi) îți trimit oferte pentru finisare completă, cu plată pe etape prin escrow." },
      { q: "Ce servicii PropManage am disponibile în Florești?", a: "Evaluarea gratuită, Scorul Casei, Cartea Casei, Digital Twin, Imobile Verificate și accesul la specialiști verificați din zona Cluj-Florești." },
      { q: "Merită o amenajare la cheie dacă fac naveta la Cluj?", a: "Da. Amenajarea la cheie coordonată printr-un singur proiect e ideală pentru proprietarii ocupați — primești oferte comparabile și urmărești lucrarea fără să fii mereu pe șantier." },
    ],
  },

  "apahida": {
    slug: "apahida",
    city: "Apahida",
    county: "județul Cluj",
    path: "/servicii-pentru-casa/apahida",
    badge: "Apahida",
    title: "Servicii pentru casă în Apahida: mentenanță, verificare și specialiști | PropManage",
    description: "Servicii pentru locuință în Apahida: evaluare gratuită pentru case, verificare la cumpărare, Cartea Casei, Digital Twin și specialiști verificați. Cont gratuit.",
    h1: "Servicii pentru casă în Apahida",
    intro: "Ai o casă în Apahida, Dezmir sau Sânnicoară? PropManage îți ține locuința sub control: evaluezi gratuit starea casei, îi construiești istoricul și găsești specialiști verificați pentru acoperiș, instalații, izolație sau curte.",
    localContext: [
      "Apahida este o comună în plină expansiune la est de Cluj-Napoca, pe axa DN1/E576, cu o zonă logistică și industrială puternică și o dezvoltare rezidențială constantă. Satele Apahida, Dezmir, Sânnicoară și Corpadea adună atât gospodării mai vechi, cât și case noi în ansambluri rezidențiale.",
      "Spre deosebire de apartamentele din oraș, aici predomină casele individuale, care cer o mentenanță proprie: acoperiș, instalații, sistem de încălzire, izolație și lucrări în curte. Mulți proprietari cumpără casă sau teren cu construcție, iar o verificare tehnică înainte de tranzacție face diferența.",
    ],
    housingTypes: [
      "Case individuale în Apahida, Dezmir, Sânnicoară și Corpadea",
      "Case noi și duplexuri în ansambluri rezidențiale recente",
      "Gospodării mai vechi care au nevoie de reabilitare și modernizare",
      "Terenuri cu construcții noi, cumpărate pentru mutare din oraș",
    ],
    ownerNeeds: [
      "Mentenanța casei: acoperiș, jgheaburi, fațadă, instalații",
      "Verificarea tehnică la cumpărarea unei case sau a unui teren cu construcție",
      "Izolare termică și eficiență energetică pentru case individuale",
      "Sisteme de încălzire, instalații sanitare și electrice pentru case",
      "Cartea Casei și istoricul lucrărilor pentru o casă nouă sau reabilitată",
    ],
    specialistsIntro: "Pentru o casă în Apahida ai nevoie de constructori, acoperișari, instalatori, electricieni, auditori energetici și specialiști HVAC. Pe PropManage descrii lucrarea, primești oferte de la specialiști verificați din zona Cluj-Apahida, compari și lucrezi cu plata protejată prin escrow.",
    faq: [
      { q: "PropManage este util și pentru case, nu doar apartamente?", a: "Da. Casele din Apahida au nevoi specifice — acoperiș, instalații, încălzire, izolație, curte. Evaluarea locuinței și specialiștii verificați acoperă toate aceste lucrări." },
      { q: "Pot verifica o casă înainte să o cumpăr în Apahida?", a: "Da. O verificare tehnică îți arată starea reală a casei sau a construcției de pe teren (structură, acoperiș, instalații, umezeală) înainte să semnezi." },
      { q: "Ce servicii PropManage sunt disponibile în Apahida?", a: "Evaluarea gratuită, Scorul Casei, Cartea Casei, Digital Twin, Imobile Verificate și accesul la specialiști verificați din zona Cluj-Apahida." },
      { q: "Cum găsesc un constructor sau acoperișar de încredere?", a: "Postezi cererea în contul gratuit, iar specialiștii verificați din zonă îți trimit oferte. Alegi în funcție de profil, portofoliu și recenzii reale." },
    ],
  },

  "baciu": {
    slug: "baciu",
    city: "Baciu",
    county: "județul Cluj",
    path: "/servicii-pentru-casa/baciu",
    badge: "Baciu",
    title: "Servicii pentru casă în Baciu: mentenanță, verificare și specialiști | PropManage",
    description: "Servicii pentru locuință în Baciu: evaluare gratuită pentru case, verificare la cumpărare, Cartea Casei, Digital Twin și specialiști verificați. Cont gratuit.",
    h1: "Servicii pentru casă în Baciu",
    intro: "Locuiești în Baciu, Suceagu sau Rădaia? PropManage îți aduce evaluarea gratuită a locuinței, istoricul casei și specialiști verificați pentru mentenanță, reparații și verificări la cumpărare — dintr-un singur cont gratuit.",
    localContext: [
      "Baciu este o comună la nord-vest de Cluj-Napoca, alipită practic de cartierul Grigorescu, formată din satele Baciu, Suceagu, Rădaia, Mera și Corușu. Apropierea de oraș a transformat-o într-o zonă suburbană atractivă, cu o dezvoltare rezidențială constantă de case și mici ansambluri.",
      "Fondul locativ este dominat de case individuale — de la gospodării mai vechi în satele comunei, la case noi ridicate de familii care se mută din Cluj. Aceste locuințe cer mentenanță proprie (acoperiș, instalații, izolație), iar cumpărătorii au nevoie de o verificare tehnică serioasă înainte de tranzacție.",
    ],
    housingTypes: [
      "Case individuale în Baciu, Suceagu, Rădaia, Mera și Corușu",
      "Case noi ridicate de familii mutate din Cluj-Napoca",
      "Gospodării mai vechi care au nevoie de modernizare",
      "Mici ansambluri rezidențiale și duplexuri recente",
    ],
    ownerNeeds: [
      "Mentenanța casei: acoperiș, fațadă, instalații, sistem de încălzire",
      "Verificarea tehnică la cumpărarea unei case în comună",
      "Izolare termică și reducerea facturilor pentru case individuale",
      "Reparații și modernizări la gospodăriile mai vechi",
      "Evaluarea și pregătirea casei pentru o vânzare avantajoasă",
    ],
    specialistsIntro: "Pentru o casă în Baciu găsești pe PropManage constructori, acoperișari, instalatori, electricieni, zugravi și auditori energetici. Postezi cererea, primești oferte de la specialiști verificați din zona Cluj-Baciu, compari profiluri și recenzii, iar plata e protejată prin escrow.",
    faq: [
      { q: "Ce servicii PropManage sunt disponibile în Baciu?", a: "Evaluarea gratuită a locuinței, Scorul Casei, Cartea Casei, Digital Twin, Imobile Verificate și accesul la specialiști verificați din zona Cluj-Baciu." },
      { q: "PropManage ajută la mentenanța unei case?", a: "Da. Casele din Baciu cer întreținere periodică — acoperiș, instalații, izolație. Evaluarea locuinței îți arată ce merită rezolvat întâi, iar specialiștii verificați execută lucrările." },
      { q: "Pot verifica o casă înainte să o cumpăr în Baciu?", a: "Da. O verificare tehnică îți arată starea reală a casei (structură, acoperiș, instalații, umezeală) înainte să semnezi, prin programul Imobile Verificate și un audit al locuinței." },
      { q: "Cât costă să încep?", a: "Contul de proprietar și evaluarea de bază sunt gratuite. Plătești doar serviciile pe care le comanzi, cu plată protejată prin escrow." },
    ],
  },

  "bucuresti": {
    slug: "bucuresti", city: "București", county: "București-Ilfov",
    path: "/servicii-pentru-casa/bucuresti", badge: "București",
    title: "Servicii pentru casă în București: evaluare, verificare și specialiști | PropManage",
    description: "Servicii pentru locuință în București: evaluare gratuită, Scorul Casei, Cartea Casei, Digital Twin și specialiști verificați pentru apartamente și case. Cont gratuit.",
    h1: "Servicii pentru casă în București",
    intro: "Ești proprietar în București? PropManage îți aduce evaluarea gratuită a locuinței, istoricul casei și specialiști verificați într-un singur loc — fie că ai un apartament interbelic în Cotroceni, un bloc comunist în Titan sau o locuință nouă în Pipera.",
    localContext: [
      "Bucureștiul are cel mai variat și mai vechi fond locativ din țară: clădiri interbelice cu instalații depășite, blocuri din anii '70–'80 în Titan, Berceni sau Drumul Taberei și ansambluri noi în Pipera, Băneasa sau Militari. Fiecare tip cere altă abordare tehnică.",
      "Traficul, zgomotul urban și diversitatea clădirilor fac ca verificarea tehnică înainte de cumpărare și refacerea instalațiilor vechi să fie priorități recurente pentru proprietarii bucureșteni, într-o piață cu prețuri mari și mize pe măsură.",
    ],
    housingTypes: [
      "Apartamente interbelice (Cotroceni, Dorobanți) — instalații de refăcut",
      "Blocuri anii '70–'80 (Titan, Berceni, Drumul Taberei) — de optimizat",
      "Ansambluri noi (Pipera, Băneasa, Militari) — finisare și personalizare",
      "Garsoniere și studiouri pentru închiriere",
    ],
    ownerNeeds: [
      "Verificarea tehnică înainte de cumpărare, într-o piață scumpă",
      "Înlocuirea instalațiilor electrice și sanitare vechi",
      "Izolare fonică și termică la apartamentele vechi",
      "Mentenanță rapidă pentru apartamentele date în chirie",
      "Pregătirea documentelor și a stării casei pentru vânzare",
    ],
    specialistsIntro: "În București găsești pe PropManage electricieni, instalatori, constructori, zugravi, montatori de gresie și faianță, auditori energetici și specialiști HVAC. Postezi cererea, primești oferte de la specialiști verificați din zonă, compari profiluri și recenzii, cu plata protejată prin escrow.",
    faq: [
      { q: "Ce servicii PropManage sunt disponibile în București?", a: "Evaluarea gratuită, Scorul Casei, Cartea Casei, Digital Twin, Imobile Verificate și accesul la specialiști verificați din București pentru orice lucrare." },
      { q: "Pot verifica un apartament înainte să îl cumpăr în București?", a: "Da. O verificare tehnică îți arată problemele reale (instalații, umezeală, structură) înainte să semnezi, prin Imobile Verificate și un audit al locuinței." },
      { q: "Cum găsesc un specialist de încredere în București?", a: "Postezi cererea în cont, iar specialiștii verificați din zonă îți trimit oferte. Compari profiluri, portofolii și recenzii reale." },
      { q: "Cât costă evaluarea locuinței?", a: "Contul și evaluarea de bază sunt gratuite. Plătești doar serviciile comandate, cu plată protejată prin escrow." },
    ],
  },

  "timisoara": {
    slug: "timisoara", city: "Timișoara", county: "județul Timiș",
    path: "/servicii-pentru-casa/timisoara", badge: "Timișoara",
    title: "Servicii pentru casă în Timișoara: evaluare, verificare și specialiști | PropManage",
    description: "Servicii pentru locuință în Timișoara: evaluare gratuită, Scorul Casei, Cartea Casei, Digital Twin și specialiști verificați. Cont gratuit.",
    h1: "Servicii pentru casă în Timișoara",
    intro: "Ești proprietar în Timișoara? PropManage îți aduce evaluarea gratuită a locuinței și specialiști verificați — fie că ai un apartament în clădirile istorice din Cetate și Iosefin, un bloc în Circumvalațiunii sau o locuință nouă spre Dumbrăvița.",
    localContext: [
      "Timișoara are un centru istoric amplu (Cetate, Iosefin, Fabric) cu clădiri de patrimoniu ce cer instalații refăcute și restaurare atentă, alături de cartiere de blocuri (Circumvalațiunii, Lipovei, Soarelui) și o expansiune rezidențială puternică spre Dumbrăvița și Giroc.",
      "Ca oraș cu sector IT și industrial în creștere, cererea pentru amenajări funcționale, home office și verificări tehnice la cumpărare este ridicată, într-o piață dinamică cu prețuri în urcare.",
    ],
    housingTypes: [
      "Apartamente în clădiri istorice (Cetate, Iosefin, Fabric) — instalații de refăcut",
      "Blocuri (Circumvalațiunii, Lipovei, Soarelui) — de optimizat",
      "Ansambluri noi spre Dumbrăvița, Giroc, Ghiroda",
      "Apartamente pentru închiriere către angajați IT și studenți",
    ],
    ownerNeeds: [
      "Verificarea tehnică înainte de cumpărare",
      "Refacerea instalațiilor în clădirile istorice",
      "Home office și optimizarea spațiilor",
      "Izolare termică și eficiență energetică",
      "Mentenanță pentru apartamente date în chirie",
    ],
    specialistsIntro: "În Timișoara găsești pe PropManage electricieni, instalatori, constructori, zugravi, montatori de gresie și faianță, auditori energetici și specialiști HVAC. Postezi cererea, primești oferte de la specialiști verificați din zonă, cu plata protejată prin escrow.",
    faq: [
      { q: "Ce servicii PropManage sunt disponibile în Timișoara?", a: "Evaluarea gratuită, Scorul Casei, Cartea Casei, Digital Twin, Imobile Verificate și accesul la specialiști verificați din Timișoara." },
      { q: "Pot verifica un apartament înainte de cumpărare în Timișoara?", a: "Da. O verificare tehnică arată starea reală (instalații, umezeală, structură), mai ales în clădirile istorice, înainte să semnezi." },
      { q: "Cum găsesc un specialist de încredere în Timișoara?", a: "Postezi cererea în cont, iar specialiștii verificați din zonă îți trimit oferte pe care le compari după profil și recenzii." },
      { q: "Cât costă să încep?", a: "Contul și evaluarea de bază sunt gratuite; plătești doar serviciile comandate, cu escrow." },
    ],
  },

  "brasov": {
    slug: "brasov", city: "Brașov", county: "județul Brașov",
    path: "/servicii-pentru-casa/brasov", badge: "Brașov",
    title: "Servicii pentru casă în Brașov: evaluare, verificare și specialiști | PropManage",
    description: "Servicii pentru locuință în Brașov: evaluare gratuită, Scorul Casei, Cartea Casei, Digital Twin și specialiști verificați. Cont gratuit.",
    h1: "Servicii pentru casă în Brașov",
    intro: "Ești proprietar în Brașov? PropManage îți aduce evaluarea gratuită a locuinței și specialiști verificați — de la apartamentele din Centrul Vechi și Schei, la blocurile din Astra și Răcădău sau casele din Noua și zona montană.",
    localContext: [
      "Brașovul combină un centru medieval săsesc protejat (Centrul Vechi, Schei) cu cartiere de blocuri (Astra, Răcădău, Tractorul) și o piață puternic influențată de turism și de cererea de case de vacanță în zona montană Poiana Brașov.",
      "Clima montană aduce cerințe specifice de izolare termică și hidroizolație, iar cererea de amenajări pentru regim de închiriere turistică este ridicată, alături de verificările tehnice la cumpărare într-o piață cu prețuri mari.",
    ],
    housingTypes: [
      "Apartamente în Centrul Vechi și Schei — clădiri istorice de întreținut",
      "Blocuri în Astra, Răcădău, Tractorul — de optimizat",
      "Case în Noua, Bartolomeu și zona montană",
      "Apartamente și case pentru închiriere turistică",
    ],
    ownerNeeds: [
      "Izolare termică și hidroizolație pentru clima montană",
      "Amenajări pentru regim de închiriere turistică",
      "Verificarea tehnică înainte de cumpărare",
      "Refacerea instalațiilor în clădirile vechi",
      "Mentenanța caselor și acoperișurilor",
    ],
    specialistsIntro: "În Brașov găsești pe PropManage electricieni, instalatori, constructori, acoperișari, zugravi, montatori de gresie și faianță, auditori energetici și specialiști HVAC. Postezi cererea, primești oferte de la specialiști verificați din zonă, cu plata protejată prin escrow.",
    faq: [
      { q: "Ce servicii PropManage sunt disponibile în Brașov?", a: "Evaluarea gratuită, Scorul Casei, Cartea Casei, Digital Twin, Imobile Verificate și accesul la specialiști verificați din Brașov." },
      { q: "Aveți servicii pentru case de vacanță în zona montană?", a: "Da. Izolarea, hidroizolația și amenajarea pentru închiriere turistică sunt cereri frecvente, acoperite de specialiștii verificați din zonă." },
      { q: "Pot verifica o locuință înainte de cumpărare în Brașov?", a: "Da. O verificare tehnică îți arată starea reală înainte să semnezi, prin Imobile Verificate și un audit al locuinței." },
      { q: "Cât costă să încep?", a: "Contul și evaluarea de bază sunt gratuite; plătești doar serviciile comandate, cu escrow." },
    ],
  },

  "oradea": {
    slug: "oradea", city: "Oradea", county: "județul Bihor",
    path: "/servicii-pentru-casa/oradea", badge: "Oradea",
    title: "Servicii pentru casă în Oradea: evaluare, verificare și specialiști | PropManage",
    description: "Servicii pentru locuință în Oradea: evaluare gratuită, Scorul Casei, Cartea Casei, Digital Twin și specialiști verificați. Cont gratuit.",
    h1: "Servicii pentru casă în Oradea",
    intro: "Ești proprietar în Oradea? PropManage îți aduce evaluarea gratuită a locuinței și specialiști verificați — de la apartamentele din clădirile Art Nouveau din centru, la blocurile din Rogerius și Nufărul sau casele din zonele rezidențiale.",
    localContext: [
      "Oradea are unul dintre cele mai frumoase centre Art Nouveau/Secession din Europa Centrală, cu clădiri de patrimoniu restaurate ce cer instalații refăcute cu grijă, alături de cartiere de blocuri (Rogerius, Nufărul, Ioșia) și o piață stabilă, influențată de turismul balnear (Băile Felix).",
      "Investițiile constante în oraș și proximitatea graniței cu Ungaria mențin o cerere solidă pentru verificări tehnice la cumpărare, restaurare sensibilă și amenajări eficiente energetic.",
    ],
    housingTypes: [
      "Apartamente în clădiri Art Nouveau din centru — restaurare și instalații",
      "Blocuri în Rogerius, Nufărul, Ioșia — de optimizat",
      "Case în zonele rezidențiale și spre Băile Felix",
      "Apartamente pentru închiriere legate de turismul balnear",
    ],
    ownerNeeds: [
      "Restaurarea sensibilă a apartamentelor de patrimoniu",
      "Verificarea tehnică înainte de cumpărare",
      "Izolare termică și eficiență energetică",
      "Refacerea instalațiilor vechi înainte de finisaje",
      "Amenajări pentru închiriere",
    ],
    specialistsIntro: "În Oradea găsești pe PropManage electricieni, instalatori, constructori, zugravi, montatori de gresie și faianță, auditori energetici și specialiști HVAC. Postezi cererea, primești oferte de la specialiști verificați din zonă, cu plata protejată prin escrow.",
    faq: [
      { q: "Ce servicii PropManage sunt disponibile în Oradea?", a: "Evaluarea gratuită, Scorul Casei, Cartea Casei, Digital Twin, Imobile Verificate și accesul la specialiști verificați din Oradea." },
      { q: "Amenajați apartamente în clădirile istorice din centru?", a: "Da, cu respect pentru detaliile de patrimoniu și cu instalații refăcute corect de specialiști verificați." },
      { q: "Pot verifica o locuință înainte de cumpărare în Oradea?", a: "Da. O verificare tehnică îți arată starea reală înainte să semnezi." },
      { q: "Cât costă să încep?", a: "Contul și evaluarea de bază sunt gratuite; plătești doar serviciile comandate, cu escrow." },
    ],
  },

  "sibiu": {
    slug: "sibiu", city: "Sibiu", county: "județul Sibiu",
    path: "/servicii-pentru-casa/sibiu", badge: "Sibiu",
    title: "Servicii pentru casă în Sibiu: evaluare, verificare și specialiști | PropManage",
    description: "Servicii pentru locuință în Sibiu: evaluare gratuită, Scorul Casei, Cartea Casei, Digital Twin și specialiști verificați. Cont gratuit.",
    h1: "Servicii pentru casă în Sibiu",
    intro: "Ești proprietar în Sibiu? PropManage îți aduce evaluarea gratuită a locuinței și specialiști verificați — de la apartamentele din centrul istoric UNESCO, la blocurile din Vasile Aaron și Hipodrom sau casele din Șelimbăr și zonele rezidențiale.",
    localContext: [
      "Sibiul are un centru istoric săsesc protejat UNESCO, cu clădiri de patrimoniu ce cer restaurare atentă și instalații refăcute cu grijă, alături de cartiere de blocuri (Vasile Aaron, Hipodrom, Ștrand) și o expansiune rezidențială spre Șelimbăr.",
      "Turismul cultural puternic și o economie industrială solidă mențin o cerere ridicată pentru amenajări de calitate, verificări tehnice la cumpărare și amenajări pentru regim de închiriere în zona centrală.",
    ],
    housingTypes: [
      "Apartamente în centrul istoric UNESCO — restaurare și instalații",
      "Blocuri în Vasile Aaron, Hipodrom, Ștrand — de optimizat",
      "Case în Șelimbăr și zonele rezidențiale",
      "Apartamente pentru închiriere în zona centrală",
    ],
    ownerNeeds: [
      "Restaurarea sensibilă a apartamentelor din centrul istoric",
      "Verificarea tehnică înainte de cumpărare",
      "Izolare termică și eficiență energetică",
      "Amenajări pentru regim de închiriere",
      "Refacerea instalațiilor vechi înainte de finisaje",
    ],
    specialistsIntro: "În Sibiu găsești pe PropManage electricieni, instalatori, constructori, zugravi, montatori de gresie și faianță, auditori energetici și specialiști HVAC. Postezi cererea, primești oferte de la specialiști verificați din zonă, cu plata protejată prin escrow.",
    faq: [
      { q: "Ce servicii PropManage sunt disponibile în Sibiu?", a: "Evaluarea gratuită, Scorul Casei, Cartea Casei, Digital Twin, Imobile Verificate și accesul la specialiști verificați din Sibiu." },
      { q: "Amenajați apartamente în centrul istoric UNESCO?", a: "Da, cu respect pentru detaliile de patrimoniu și cu instalații refăcute corect." },
      { q: "Pot verifica o locuință înainte de cumpărare în Sibiu?", a: "Da. O verificare tehnică îți arată starea reală înainte să semnezi." },
      { q: "Cât costă să încep?", a: "Contul și evaluarea de bază sunt gratuite; plătești doar serviciile comandate, cu escrow." },
    ],
  },

  "targu-mures": {
    slug: "targu-mures", city: "Târgu Mureș", county: "județul Mureș",
    path: "/servicii-pentru-casa/targu-mures", badge: "Târgu Mureș",
    title: "Servicii pentru casă în Târgu Mureș: evaluare, verificare și specialiști | PropManage",
    description: "Servicii pentru locuință în Târgu Mureș: evaluare gratuită, Scorul Casei, Cartea Casei, Digital Twin și specialiști verificați. Cont gratuit.",
    h1: "Servicii pentru casă în Târgu Mureș",
    intro: "Ești proprietar în Târgu Mureș? PropManage îți aduce evaluarea gratuită a locuinței și specialiști verificați — de la apartamentele din clădirile Secession din centru, la blocurile din Tudor Vladimirescu și Cornișa sau casele din zonele rezidențiale.",
    localContext: [
      "Târgu Mureș combină un centru istoric cu arhitectură Secession (Palatul Culturii) cu cartiere de blocuri (Tudor Vladimirescu, Cornișa, Dâmbu Pietros) și zone rezidențiale de case. Universitatea de medicină și companiile locale aduc o cerere constantă de locuințe funcționale.",
      "Prezența comunității medicale și academice generează cereri specifice de amenajări pentru închiriere lângă campus și spitale, alături de verificări tehnice la cumpărare și reabilitări în blocurile vechi.",
    ],
    housingTypes: [
      "Apartamente în clădiri Secession din centru — instalații de refăcut",
      "Blocuri în Tudor Vladimirescu, Cornișa, Dâmbu Pietros — de optimizat",
      "Case în Aleea Carpați, Belvedere și zonele rezidențiale",
      "Apartamente pentru închiriere lângă campus și spitale",
    ],
    ownerNeeds: [
      "Amenajări funcționale pentru medici, rezidenți și cadre universitare",
      "Verificarea tehnică înainte de cumpărare",
      "Reabilitarea instalațiilor în blocurile vechi",
      "Izolare termică și eficiență energetică",
      "Amenajări pentru închiriere",
    ],
    specialistsIntro: "În Târgu Mureș găsești pe PropManage electricieni, instalatori, constructori, zugravi, montatori de gresie și faianță, auditori energetici și specialiști HVAC. Postezi cererea, primești oferte de la specialiști verificați din zonă, cu plata protejată prin escrow.",
    faq: [
      { q: "Ce servicii PropManage sunt disponibile în Târgu Mureș?", a: "Evaluarea gratuită, Scorul Casei, Cartea Casei, Digital Twin, Imobile Verificate și accesul la specialiști verificați din Târgu Mureș." },
      { q: "Pot verifica o locuință înainte de cumpărare în Târgu Mureș?", a: "Da. O verificare tehnică îți arată starea reală înainte să semnezi." },
      { q: "Cum găsesc un specialist de încredere în Târgu Mureș?", a: "Postezi cererea în cont, iar specialiștii verificați din zonă îți trimit oferte pe care le compari după profil și recenzii." },
      { q: "Cât costă să încep?", a: "Contul și evaluarea de bază sunt gratuite; plătești doar serviciile comandate, cu escrow." },
    ],
  },
};

// Sibling cross-links (internal linking between the 4 Cluj-area hubs).
const HUB_SLUGS = Object.keys(LOCAL_HUBS);

// Required internal links present on every hub + sibling hubs.
export const getLocalHubRelated = (slug) => {
  const base = [
    { to: "/scorul-casei", label: "Scorul Casei: evaluează-ți locuința" },
    { to: "/cartea-casei", label: "Cartea Casei: istoricul locuinței" },
    { to: "/digital-twin", label: "Digital Twin pentru proprietate" },
    { to: "/probleme-casa", label: "Probleme frecvente ale casei" },
    { to: "/imobile-verificate", label: "Imobile Verificate" },
    { to: "/pentru-specialisti", label: "Găsește specialiști verificați" },
    { to: "/devino-specialist", label: "Ești specialist? Înregistrează-te gratuit" },
  ];
  const siblings = HUB_SLUGS.filter((s) => s !== slug).map((s) => ({
    to: LOCAL_HUBS[s].path,
    label: `Servicii pentru casă în ${LOCAL_HUBS[s].city}`,
  }));
  return [...base, ...siblings];
};

export { SERVICES as LOCAL_SERVICES, CTA_PRIMARY as LOCAL_CTA_PRIMARY };

export const getLocalHubBySlug = (slug) => LOCAL_HUBS[slug] || null;

export const getLocalHubByPath = (pathname) =>
  Object.values(LOCAL_HUBS).find((p) => p.path === pathname) || null;

export const LOCAL_HUB_PATHS = Object.values(LOCAL_HUBS).map((p) => p.path);
