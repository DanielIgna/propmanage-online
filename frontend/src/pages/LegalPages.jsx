// Privacy Policy + Terms of Service — static public pages, GDPR-aware (RO).
import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, FileText } from "lucide-react";

const Layout = ({ icon: Icon, title, subtitle, children, testid }) => (
  <div className="min-h-screen bg-[#0a0a0b] text-stone-200 grain" data-testid={testid}>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-[#d4ff3a] mb-6">
        <ArrowLeft className="w-3 h-3" /> Înapoi acasă
      </Link>
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-6 h-6 text-[#d4ff3a]" />
        <h1 className="font-serif text-4xl sm:text-5xl text-white">{title}</h1>
      </div>
      <p className="text-stone-400 text-sm mb-8">{subtitle}</p>
      <article className="prose prose-invert prose-stone max-w-none prose-headings:font-serif prose-headings:text-white prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-p:text-sm prose-p:leading-relaxed prose-p:text-stone-300 prose-li:text-sm prose-li:text-stone-300 prose-a:text-[#d4ff3a] prose-strong:text-white">
        {children}
      </article>
      <div className="mt-12 pt-6 border-t border-stone-800 text-xs text-stone-500">
        Pentru întrebări legate de date sau drepturile tale: <a href="mailto:contact@propmanage.ro" className="text-[#d4ff3a]">contact@propmanage.ro</a>
      </div>
    </div>
  </div>
);

export const PrivacyPage = () => (
  <Layout icon={Shield} title="Politică de confidențialitate" subtitle="Ultima actualizare: februarie 2026" testid="privacy-page">
    <p><strong>PropManage SRL</strong> ("noi", "platforma") respectă confidențialitatea utilizatorilor și se conformează regulamentului GDPR (Regulamentul UE 2016/679) și legislației române privind protecția datelor personale.</p>

    <h2>1. Ce date colectăm</h2>
    <ul>
      <li><strong>Date de cont</strong>: nume, email, telefon, rol (client / specialist / operator).</li>
      <li><strong>Date despre proprietăți</strong>: adresă, fotografii, plan, istoric mentenanță (doar pentru proprietățile tale).</li>
      <li><strong>Date de plată</strong>: procesate exclusiv prin Stripe — nu stocăm numerele de card.</li>
      <li><strong>Conversații cu AI Concierge</strong>: pentru îmbunătățirea serviciului, cu redactare automată a datelor sensibile.</li>
      <li><strong>Logging tehnic</strong>: IP, user-agent, ora accesului, pentru securitate și anti-abuz.</li>
    </ul>

    <h2>2. Cum folosim datele</h2>
    <ul>
      <li>Furnizarea serviciilor platformei (matching specialiști, plăți escrow, Digital Twin).</li>
      <li>Comunicare tranzacțională (notificări proiecte, plăți, dispute).</li>
      <li>Îmbunătățire produs (analiză agregată — niciodată identificabilă).</li>
      <li>Conformitate legală (facturi, audit, anti-fraudă).</li>
    </ul>
    <p><strong>NU vindem date</strong> către terți și NU folosim datele pentru reclamă behavioral targeting.</p>

    <h2>3. Cu cine partajăm datele</h2>
    <ul>
      <li><strong>Specialiști / Clienți</strong>: doar datele necesare pentru o cerere activă comună (nume, locație, descriere lucrare).</li>
      <li><strong>Stripe</strong> (procesare plăți).</li>
      <li><strong>Anthropic / Emergent</strong> (motorul AI Concierge — fără PII, redactare automată).</li>
      <li><strong>Resend</strong> (livrare emailuri tranzacționale).</li>
      <li><strong>Autorități</strong> doar la cerere legală formală (instanță, ANAF, GDPR DSAR).</li>
    </ul>

    <h2>4. Drepturile tale (GDPR)</h2>
    <ul>
      <li><strong>Acces</strong>: cere o copie a datelor tale.</li>
      <li><strong>Rectificare</strong>: corectează date inexacte.</li>
      <li><strong>Ștergere</strong> ("dreptul de a fi uitat"): cere ștergerea contului și a datelor (exceptând cele necesare pentru obligații legale).</li>
      <li><strong>Portabilitate</strong>: primește datele într-un format structurat (JSON / CSV).</li>
      <li><strong>Obiecție</strong>: opune-te procesării pentru anumite scopuri.</li>
      <li><strong>Plângere ANSPDCP</strong>: dacă consideri că drepturile îți sunt încălcate.</li>
    </ul>
    <p>Pentru orice cerere DSAR, scrie la <a href="mailto:contact@propmanage.ro">contact@propmanage.ro</a> — răspundem în maximum 30 zile.</p>

    <p className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
      <strong className="text-[#d4ff3a]">📑 Notificări de confidențialitate per rol:</strong>{" "}
      Vezi notificările detaliate pentru <Link to="/privacy/notices" className="text-[#d4ff3a] underline">Client, Specialist, Operator, Vizitator + DPA (B2B)</Link> — toate descărcabile ca PDF.
    </p>

    <h2>5. Cookies</h2>
    <p>Folosim cookies <strong>strict necesare</strong> (autentificare, preferințe UI) și NU folosim cookies de tracking publicitar. Nu este necesar consent banner pentru cookies necesare.</p>

    <h2>6. Retenția datelor</h2>
    <ul>
      <li>Date cont activ: pe durata existenței contului.</li>
      <li>Date tranzacționale (facturi, contracte): 10 ani (obligație legală).</li>
      <li>Date AI Concierge: maxim 90 zile, apoi anonimizate.</li>
      <li>Logs securitate: maxim 12 luni.</li>
    </ul>

    <h2>7. Securitate</h2>
    <p>Aplicăm criptare la rest și în tranzit (HTTPS), hash bcrypt pentru parole, validare prompt-injection pentru AI, rate limiting, GEO / VPN blocking, monitorizare 24/7 cu sistem AI Health Score.</p>

    <h2>8. Modificări</h2>
    <p>Vom anunța modificările materiale prin email cu cel puțin 14 zile înainte de intrarea în vigoare.</p>
  </Layout>
);

export const TermsPage = () => (
  <Layout icon={FileText} title="Termeni și condiții" subtitle="Ultima actualizare: februarie 2026" testid="terms-page">
    <p>Prin utilizarea platformei <strong>PropManage</strong> ("Platforma"), accepți acești Termeni. Dacă nu ești de acord, te rugăm să nu folosești serviciile.</p>

    <h2>1. Cine este responsabil</h2>
    <p>Operator: <strong>PropManage SRL</strong>, sediu social în România. Contact: <a href="mailto:contact@propmanage.ro">contact@propmanage.ro</a>.</p>

    <h2>2. Cont utilizator</h2>
    <ul>
      <li>Trebuie să ai minim 18 ani și să furnizezi date reale.</li>
      <li>Răspunzi pentru păstrarea în siguranță a parolei.</li>
      <li>Ne rezervăm dreptul de a suspenda conturi în caz de abuz, fraudă sau încălcare a acestor termeni.</li>
    </ul>

    <h2>3. Roluri</h2>
    <ul>
      <li><strong>Client</strong>: postează cereri, contractează specialiști, plătește în escrow.</li>
      <li><strong>Specialist</strong>: oferă servicii contra cost, plătește 45 RON / lead acceptat, primește 95% din valoarea proiectului.</li>
      <li><strong>Operator</strong>: validează Digital Twin-uri (la invitație Admin).</li>
      <li><strong>Admin</strong>: rol intern — nu se înregistrează prin formular public.</li>
    </ul>

    <h2>4. Plăți și escrow</h2>
    <ul>
      <li>Toate plățile sunt procesate prin Stripe (PCI-DSS Level 1).</li>
      <li>Fondurile sunt blocate în escrow până la confirmarea livrării de către client.</li>
      <li>Pentru proiecte multi-milestone, fiecare tranșă (25%) se eliberează după acceptul clientului.</li>
      <li><strong>Garanție 30 zile</strong>: pe tranșa finală există rețineți o garanție automată, eliberată după 30 zile sau confirmare explicită.</li>
      <li>Comision platformă: <strong>5%</strong> din valoarea fiecărei tranșe.</li>
      <li>Lead-fee specialist: <strong>45 RON</strong> per acceptare.</li>
    </ul>

    <h2>5. Dispute</h2>
    <p>Disputele se rezolvă inițial direct între părți prin chat-ul integrat. Dacă nu se ajunge la o soluție în 7 zile, intervine echipa PropManage prin arbitraj intern. Decizia poate fi contestată conform legislației.</p>

    <h2>6. Trust Score și verificare</h2>
    <p>Specialiștii sunt verificați manual de echipa de Admin. Trust Score este calculat automat din evaluări, rate de livrare la timp, dispute. Nu garantăm calitatea individuală a fiecărui specialist — este un marketplace P2P.</p>

    <h2>7. AI Concierge</h2>
    <p>Concierge AI este un asistent informativ. <strong>Nu execută acțiuni</strong> în cont. Răspunsurile pot conține inacurăți — verifică întotdeauna în UI sau cu suportul uman pentru decizii importante.</p>

    <h2>8. Interdicții</h2>
    <ul>
      <li>Folosirea platformei pentru activități ilegale, scam, money laundering.</li>
      <li>Încercări de prompt injection, scraping automat, evitarea sistemelor de securitate.</li>
      <li>Postarea de conținut ofensator, discriminatoriu, sau care încalcă proprietatea intelectuală.</li>
      <li>Comunicarea în afara platformei pentru a evita comisionul (anti-circumvent).</li>
    </ul>

    <h2>9. Răspundere</h2>
    <p>Platforma este "AS IS". Nu garantăm continuitatea serviciului 24/7 (vezi <Link to="/status" className="text-[#d4ff3a]">/status</Link>). Răspunderea noastră maximă este limitată la valoarea comisioanelor încasate în ultimele 12 luni de la utilizator.</p>

    <h2>10. Reziliere</h2>
    <p>Poți închide contul oricând din setări. Datele tranzacționale rămân arhivate conform <Link to="/privacy" className="text-[#d4ff3a]">Politicii de Confidențialitate</Link>.</p>

    <h2>11. Legea aplicabilă</h2>
    <p>Acești termeni sunt guvernați de legea română. Disputele se rezolvă la instanțele competente din România.</p>

    <h2>12. Modificări</h2>
    <p>Vom notifica modificările materiale prin email cu cel puțin 14 zile înainte.</p>
  </Layout>
);
