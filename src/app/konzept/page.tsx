import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DocsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-full bg-white">
      {/* Print-optimierte Styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .docs-content { max-width: 100% !important; padding: 0 !important; }
          .page-break { page-break-before: always; }
          h2 { page-break-after: avoid; }
          section { page-break-inside: avoid; }
        }
      `}</style>

      {/* Header – nicht im Druck */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between px-5 py-4 border-b border-border bg-white">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Tradent" className="h-4 shrink-0" />
        </a>
        <a href="/" className="text-sm font-semibold text-text-muted hover:text-text-primary transition-colors">
          Zurück zur App
        </a>
      </header>

      <main className="docs-content max-w-2xl mx-auto px-5 py-12 space-y-16">

        {/* Titel */}
        <div className="space-y-4">
          <img src="/logo.svg" alt="Tradent" className="h-5 hidden print:block" />
          <h1 className="text-4xl font-black text-text-primary tracking-tight">
            Tradent Konzept
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed">
            Systematisches Daytrading mit KI-gestuetzter Signalanalyse, akademisch fundiertem Risikomanagement und vollstaendiger Kostentransparenz.
          </p>
          <p className="text-sm text-text-muted">
            Stand: Mai 2026 &middot; Vertraulich
          </p>
        </div>


        {/* 1. Grundlagen */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-text-primary">1. Grundlagen</h2>
          <p className="text-text-secondary leading-relaxed">
            Tradent liefert jeden Morgen genau zwei Trading-Signale: ein konservatives <strong>Steady-Signal</strong> und ein offensiveres <strong>Bold-Signal</strong>. Die App richtet sich an Daytrader, die auf CFD-Basis ueber den Broker XTB handeln. Der zentrale Gedanke: weniger ist mehr.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Anstatt Dutzende Signale zu generieren und den Nutzer mit Optionen zu ueberfluten, trifft Tradent eine klare Vorauswahl. Aus einem Universum von 55 Assets wird pro Tag das jeweils beste Signal pro Risikokategorie ermittelt. Das reduziert Entscheidungsstress und foerdert Disziplin &mdash; zwei der wichtigsten Faktoren fuer langfristigen Trading-Erfolg.
          </p>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-3">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Kernprinzipien</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex gap-2"><span className="text-text-primary font-bold shrink-0">Taegliche Routine</span><span>&mdash; Signale erscheinen morgens, der Trade wird bis Marktschluss geschlossen. Kein Overnight-Risiko, kein staendiges Monitoring.</span></li>
              <li className="flex gap-2"><span className="text-text-primary font-bold shrink-0">Zwei Signale, nicht mehr</span><span>&mdash; Steady (konservativ, hohe Trefferquote) und Bold (offensiver, hoeheres Gewinnpotenzial). Klare Aufteilung, keine Ueberladung.</span></li>
              <li className="flex gap-2"><span className="text-text-primary font-bold shrink-0">Kein Signal ist ein Signal</span><span>&mdash; Wenn die Konfidenz unter den Mindestwert faellt, zeigt die App bewusst kein Signal an. Disziplin ueber Aktivitaet.</span></li>
              <li className="flex gap-2"><span className="text-text-primary font-bold shrink-0">Mobile-First</span><span>&mdash; Optimiert fuer das iPhone. Signal pruefen, Trade eroeffnen, Position monitoren &mdash; alles in unter 60 Sekunden.</span></li>
              <li className="flex gap-2"><span className="text-text-primary font-bold shrink-0">Volle Transparenz</span><span>&mdash; Jedes Signal zeigt die Begruendung, jede P&amp;L-Berechnung enthaelt Spread-Kosten. Keine versteckten Zahlen.</span></li>
            </ul>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-3">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Tagesablauf</h3>
            <div className="space-y-2 text-sm text-text-secondary">
              <p><strong>09:15 CET</strong> &mdash; Push-Notification: Neue Signale verfuegbar. Die App hat bereits 55 Assets analysiert und die besten zwei ausgewaehlt.</p>
              <p><strong>09:15 &ndash; 10:00</strong> &mdash; Optimales Einstiegsfenster. Signal pruefen, Kurs revalidieren, Position eroeffnen.</p>
              <p><strong>Tagsuelber</strong> &mdash; Automatisches Monitoring. Die App prueft alle 60 Sekunden ob Stop-Loss oder Take-Profit erreicht wurde.</p>
              <p><strong>1h vor Marktschluss</strong> &mdash; Close-Reminder per Push. Offene Positionen vor Handelsende schliessen.</p>
              <p><strong>22:00 CET</strong> &mdash; Automatische Auswertung: Hat der Kurs im Tagesverlauf TP oder SL erreicht?</p>
            </div>
          </div>
        </section>


        {/* 2. Signal Research */}
        <section className="space-y-4 page-break">
          <h2 className="text-2xl font-black text-text-primary">2. Signal Research</h2>
          <p className="text-text-secondary leading-relaxed">
            Die Signalqualitaet ist das Herzstueck von Tradent. Die Analyse folgt einer strengen vierstufigen Hierarchie, die sicherstellt, dass jedes Signal auf mehreren unabhaengigen Datenpunkten basiert &mdash; nicht auf einer einzelnen KI-Meinung.
          </p>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Stufe 1 &mdash; Technische Analyse (Kernentscheidung)</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Die primaere Entscheidungsgrundlage. Der RSI-14 identifiziert ueberkaufte und ueberverkaufte Zonen, der SMA-20 bestimmt den kurzfristigen Trend, und die Price Action der letzten 5 Tage definiert Support- und Resistance-Level. Daraus ergeben sich Richtung (LONG/SHORT), Einstiegskurs, Stop-Loss und Take-Profit.
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Momentum-Strategien sind die in der akademischen Literatur am besten belegte Methode fuer kurzfristiges Trading. Die 1-Tages- und 5-Tages-Veraenderung bestaetigt oder widerspricht den Trend aus der technischen Analyse.
            </p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Stufe 2 &mdash; Event-Filter (Veto-Funktion)</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Events wie Quartalszahlen, Zentralbank-Entscheidungen (FOMC, EZB) oder Wirtschaftsdaten (NFP, CPI) erzeugen extreme Volatilitaet. Das Problem: Wir wissen nicht in welche Richtung der Kurs geht, nur dass er stark schwanken wird. Deshalb wirken Events als Veto &mdash; kein Richtungssignal, sondern reines Risikomanagement.
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Steht bei einer Aktie heute oder morgen der Quartalsbericht an, wird die Konfidenz um 20&ndash;30% gesenkt oder das Asset komplett gemieden. Bei FOMC-Entscheidungen werden betroffene Maerkte (Indizes, Forex) aus der Analyse genommen.
            </p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Stufe 3 &mdash; Sentiment-Justierung (Feinjustierung)</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Der Fear &amp; Greed Index (0&ndash;100) misst die Marktstimmung. Er wird als Kontraindikator eingesetzt: Extreme Angst (&lt;20) erhoet die Konfidenz fuer Long-Positionen um 5&ndash;10%, extreme Gier (&gt;80) senkt sie. Im neutralen Bereich (20&ndash;80) hat der Index keinen Einfluss. Sentiment-Daten erzeugen nie ein eigenes Signal, sondern justieren bestehende Signale leicht nach.
            </p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Stufe 4 &mdash; Gegencheck (Qualitaetsfilter)</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Nachdem die Analyse ein Signal generiert hat, wird es einem unabhaengigen Gegencheck unterzogen. Dieser prueft aktuelle Nachrichten auf konkrete, ueberraschende Ereignisse der letzten 24 Stunden &mdash; z.B. ueberraschende Regulierungsmassnahmen, Unternehmens-Skandale oder Flash-Crashes.
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Entscheidend: Der Gegencheck ist richtungsabhaengig. Bei einem SHORT-Trade sind negative Nachrichten kein Risiko, sondern eine Bestaetigung. Nur Nachrichten die <strong>gegen</strong> die geplante Trade-Richtung sprechen, fuehren zu einer Warnung. Allgemeine Marktlage, laufende Konflikte oder bekannte Wirtschaftsdaten werden bewusst ignoriert &mdash; sie sind bereits in der technischen Analyse eingepreist.
            </p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-3">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Konfidenz-Schwellen</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Nicht jedes generierte Signal wird angezeigt. Tradent erzwingt Mindest-Konfidenzen im Code:
            </p>
            <ul className="space-y-1 text-sm text-text-secondary">
              <li><strong>Steady-Signal:</strong> Mindestens 70% Konfidenz, sonst wird das Signal ausgeblendet</li>
              <li><strong>Bold-Signal:</strong> Mindestens 50% Konfidenz, sonst wird das Signal ausgeblendet</li>
            </ul>
            <p className="text-sm text-text-secondary leading-relaxed">
              Die Schwellen liegen bewusst unter den Prompt-Vorgaben (75%/55%), da der Gegencheck die Konfidenz reduzieren kann. Das Kalkuel: Spread-Kosten machen Trades mit niedriger Ueberzeugung mathematisch unrentabel. &bdquo;Kein Signal heute&ldquo; ist ein Feature, kein Fehler.
            </p>
          </div>
        </section>


        {/* 3. Product Range */}
        <section className="space-y-4 page-break">
          <h2 className="text-2xl font-black text-text-primary">3. Product Range</h2>
          <p className="text-text-secondary leading-relaxed">
            Tradent analysiert 55 handelbare Assets ueber fuenf Anlageklassen. Alle Produkte sind als CFDs ueber den Broker XTB verfuegbar. Die Auswahl deckt die liquidesten und meistgehandelten Instrumente ab &mdash; breit genug fuer Diversifikation, fokussiert genug fuer qualitativ hochwertige Signale.
          </p>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Indizes (8 Assets)</h3>
            <p className="text-sm text-text-secondary">
              DE40 (DAX), EU50 (Euro Stoxx 50), FRA40 (CAC 40), UK100 (FTSE 100), JAP225 (Nikkei), US500 (S&amp;P 500), US100 (Nasdaq), US30 (Dow Jones)
            </p>
            <p className="text-xs text-text-muted">Spread: ~0.03% &middot; Handel: Mo&ndash;Fr, je nach Boerse</p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Aktien (21 Assets)</h3>
            <p className="text-sm text-text-secondary">
              <strong>Europa:</strong> SAP, Siemens, ASML, LVMH, Volkswagen, Deutsche Bank<br />
              <strong>USA:</strong> Tesla, Nvidia, Apple, Microsoft, Amazon, Meta, Alphabet, AMD, Netflix, Intel, Boeing, JP Morgan, Goldman Sachs, Disney, Coca-Cola
            </p>
            <p className="text-xs text-text-muted">Spread: ~0.06% &middot; Handel: Mo&ndash;Fr, XETRA 09:00&ndash;17:30, NYSE/NASDAQ 15:30&ndash;22:00 CET</p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Forex (8 Paare)</h3>
            <p className="text-sm text-text-secondary">
              EUR/USD, GBP/USD, USD/JPY, USD/CHF, EUR/GBP, AUD/USD, USD/CAD, NZD/USD
            </p>
            <p className="text-xs text-text-muted">Spread: ~0.015% &middot; Handel: Mo&ndash;Fr, nahezu 24h</p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Rohstoffe (6 Assets)</h3>
            <p className="text-sm text-text-secondary">
              Gold, Silber, Platin, WTI Oel, Brent Oel, Erdgas
            </p>
            <p className="text-xs text-text-muted">Spread: ~0.04% &middot; Handel: Mo&ndash;Fr, je nach Boerse</p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Krypto (12 Assets)</h3>
            <p className="text-sm text-text-secondary">
              Bitcoin, Ethereum, Solana, Ripple, Cardano, Polkadot, Chainlink, Avalanche, Litecoin, Dogecoin, Polygon, Uniswap
            </p>
            <p className="text-xs text-text-muted">Spread: ~0.20% &middot; Handel: 7 Tage/Woche (einzige Klasse am Wochenende)</p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-3">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Marktmodi</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li><strong>Wochentag:</strong> Alle 55 Assets werden analysiert</li>
              <li><strong>Wochenende:</strong> Nur 12 Krypto-Assets (einziger 24/7-Markt)</li>
              <li><strong>XETRA-Feiertag:</strong> Ohne XETRA/EU &mdash; US, Forex, Rohstoffe und Krypto bleiben verfuegbar (basiert auf dem offiziellen XETRA-Handelskalender, nicht auf gesetzlichen Feiertagen)</li>
              <li><strong>NYSE-Feiertag:</strong> Ohne NYSE/NASDAQ &mdash; EU, Forex, Rohstoffe und Krypto bleiben verfuegbar (basiert auf dem offiziellen NYSE-Kalender)</li>
              <li><strong>Doppel-Feiertag:</strong> Wenn XETRA, NYSE und CME gleichzeitig geschlossen sind (z.B. Karfreitag, Neujahr) &mdash; nur Forex und Krypto (20 Assets)</li>
            </ul>
          </div>
        </section>


        {/* 4. Risikomanagement */}
        <section className="space-y-4 page-break">
          <h2 className="text-2xl font-black text-text-primary">4. Risikomanagement</h2>
          <p className="text-text-secondary leading-relaxed">
            Das Risikomanagement basiert auf dem Kelly Criterion &mdash; einer mathematisch optimalen Methode zur Bestimmung der Positionsgroesse, entwickelt von John L. Kelly Jr. bei Bell Labs (1956) und seitdem von professionellen Tradern und Hedgefonds eingesetzt.
          </p>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Kelly Criterion &mdash; Position Sizing</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Das Kelly Criterion berechnet den optimalen Anteil des Kapitals fuer jeden Trade, basierend auf der Gewinnwahrscheinlichkeit (Konfidenz) und dem Verhaeltnis von potenziellem Gewinn zu potenziellem Verlust (Risk/Reward Ratio). Die Formel maximiert langfristiges Kapitalwachstum und verhindert gleichzeitig ueberdimensionierte Positionen.
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Tradent verwendet <strong>Half Kelly</strong> (Fraction 0.5): Die berechnete optimale Position wird halbiert. Dadurch erreicht das System 75% des theoretischen Wachstums bei nur 50% der Varianz. Das bedeutet deutlich glattere Equity-Kurven und geringeres Ruin-Risiko.
            </p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Barbell-Strategie</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Das Budget wird auf zwei Signale aufgeteilt, nicht gleichmaessig 50/50, sondern proportional zum Kelly-Edge. Ein Signal mit hoeherem Edge (bessere Konfidenz oder besseres Risk/Reward) erhaelt einen groesseren Anteil. Gleichzeitig gelten feste Grenzen:
            </p>
            <ul className="space-y-1 text-sm text-text-secondary">
              <li><strong>Mindest-Allokation:</strong> 20% des Budgets pro Signal (Barbell-Garantie)</li>
              <li><strong>Exposure-Cap:</strong> Maximal 90% des Budgets eingesetzt, 10% bleiben als Reserve</li>
              <li><strong>Budget-Basis:</strong> Allokation basiert auf dem Original-Budget, nicht auf dem aktuellen Balance &mdash; damit die Aufteilung stabil bleibt</li>
            </ul>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Leverage-Strategie</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Der Hebel ist an die Risikokategorie gebunden, nicht an das Asset. Das vereinfacht die Risikokontrolle und macht den maximalen Verlust vorhersagbar.
            </p>
            <ul className="space-y-1 text-sm text-text-secondary">
              <li><strong>Steady:</strong> 2&ndash;5x Leverage, konservativ, auf hohe Trefferquote optimiert</li>
              <li><strong>Bold:</strong> 5&ndash;10x Leverage, offensiver, auf hoeheres Gewinnpotenzial optimiert</li>
            </ul>
            <p className="text-sm text-text-secondary leading-relaxed">
              Jeder Trade hat einen fest definierten Stop-Loss. Der maximale Verlust pro Trade ist damit vor Eroeffnung bekannt und begrenzt. Das Risk/Reward Ratio liegt bei mindestens 1:1.5 &mdash; der potenzielle Gewinn uebersteigt den potenziellen Verlust immer.
            </p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Spread-Kosten &mdash; Vollstaendige Transparenz</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Jede P&amp;L-Berechnung in Tradent enthaelt die realen XTB-Spread-Kosten. Der Spread wird mit dem Hebel multipliziert, da gehebelte Positionen den Spread proportional verstaerken. Das bedeutet: Ein Krypto-Trade mit x10 Hebel startet effektiv bei -2.0% (0.20% Spread x 10).
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-text-secondary mt-2">
              <span>Index:</span><span className="font-bold">0.03%</span>
              <span>Aktie:</span><span className="font-bold">0.06%</span>
              <span>Forex:</span><span className="font-bold">0.015%</span>
              <span>Rohstoff:</span><span className="font-bold">0.04%</span>
              <span>Krypto:</span><span className="font-bold">0.20%</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed mt-2">
              Diese Kosten werden angewendet auf: Live-P&amp;L, Auto-Close, manuelles Schliessen, und theoretische Auswertungen. Es gibt keine versteckten Kosten.
            </p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Schutzmechanismen</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li><strong>Revalidierung:</strong> Vor jeder Trade-Eroeffnung wird der aktuelle Kurs geprueft. Wenn der Kurs bereits den Stop-Loss durchbrochen hat oder das Gewinnpotenzial zu gering ist, wird der Trade blockiert.</li>
              <li><strong>Auto-Close:</strong> Alle 60 Sekunden prueft die App ob Stop-Loss oder Take-Profit erreicht wurde. Bei Erreichen wird die Position automatisch zum entsprechenden Kurs geschlossen.</li>
              <li><strong>Daytrading-Only:</strong> Alle Positionen werden bis Marktschluss geschlossen. Kein Overnight-Risiko, keine Gap-Verluste.</li>
              <li><strong>Signal-Invalidierung:</strong> Wenn der Kurs vor dem Eroeffnen des Trades unter den Stop-Loss faellt, wird das Signal permanent deaktiviert.</li>
            </ul>
          </div>
        </section>


        {/* 5. Performance & Tracking */}
        <section className="space-y-4 page-break">
          <h2 className="text-2xl font-black text-text-primary">5. Performance &amp; Tracking</h2>
          <p className="text-text-secondary leading-relaxed">
            Jedes Signal wird systematisch ausgewertet &mdash; unabhaengig davon, ob der Trade tatsaechlich ausgefuehrt wurde. Das ermoeglicht eine objektive Bewertung der Signalqualitaet ueber Zeit und bildet die Grundlage fuer kontinuierliche Verbesserung.
          </p>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Automatische Auswertung</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Jeden Abend um 22:00 CET analysiert ein automatisierter Prozess die Intraday-Kursdaten jedes Signals. Anhand der Tageshoch- und Tiefstwerte wird ermittelt, ob der Kurs im Tagesverlauf den Take-Profit oder Stop-Loss erreicht haette. Vier moegliche Ergebnisse:
            </p>
            <ul className="space-y-1 text-sm text-text-secondary">
              <li><strong className="text-green-600">TP Hit</strong> &mdash; Take-Profit wurde im Tagesverlauf erreicht</li>
              <li><strong className="text-red-600">SL Hit</strong> &mdash; Stop-Loss wurde im Tagesverlauf erreicht</li>
              <li><strong className="text-amber-600">Partial</strong> &mdash; Weder TP noch SL erreicht, aber im Plus geschlossen</li>
              <li><strong className="text-text-muted">Neutral</strong> &mdash; Weder TP noch SL erreicht, flat oder im Minus</li>
            </ul>
            <p className="text-sm text-text-secondary leading-relaxed">
              Konservative Bewertung: Wenn sowohl TP als auch SL im Tagesverlauf beruehrt wurden, wird das Signal als SL Hit gewertet (Worst-Case-Annahme).
            </p>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Was gemessen wird</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li><strong>Hit-Rate:</strong> Wie oft wird Take-Profit erreicht vs. Stop-Loss? Die zentrale Kennzahl fuer die Signalqualitaet.</li>
              <li><strong>Steady vs. Bold:</strong> Welche Risikokategorie performt besser? Bestaetigt die Barbell-Strategie ihren Nutzen?</li>
              <li><strong>Nach Asset-Klasse:</strong> Indizes vs. Aktien vs. Forex vs. Rohstoffe vs. Krypto &mdash; wo sind die Signale am zuverlaessigsten?</li>
              <li><strong>Konfidenz-Kalibrierung:</strong> Stimmen 80% Konfidenz auch mit ~80% Trefferquote ueberein? Wenn nicht, werden die Schwellen nachjustiert.</li>
              <li><strong>Theoretisches P&amp;L:</strong> Was waere das Ergebnis gewesen, haette man jeden Trade exakt nach Plan ausgefuehrt? Inklusive Kelly-Allokation und Spread-Kosten.</li>
            </ul>
          </div>

          <div className="bg-bg-secondary rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Feedback-Loop</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Die Performance-Daten fliessen zurueck in die Analyse: Schlechte Asset-Klassen werden seltener empfohlen, Konfidenz-Schwellen werden kalibriert, und die Gewichtung der Datenquellen wird nachjustiert. Das System lernt nicht aus einzelnen Trades, sondern aus Mustern ueber Wochen und Monate.
            </p>
          </div>
        </section>


        {/* 6. Kostenstruktur */}
        <section className="space-y-4 page-break">
          <h2 className="text-2xl font-black text-text-primary">6. Kostenstruktur</h2>
          <p className="text-text-secondary leading-relaxed">
            Tradent ist bewusst auf minimale Betriebskosten ausgelegt. Die gesamte Infrastruktur laeuft auf kostenlosen Diensten (Free Tiers) und guenstigen APIs. Es gibt keine Abonnementgebuehren, keine versteckten Kosten, keine Premium-Tiers.
          </p>

          <div className="bg-bg-secondary rounded-[12px] p-5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-text-secondary">KI-Engine (Signalanalyse)</span>
                <span className="font-bold text-text-primary">~1&ndash;3 EUR/Monat</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-text-secondary">News-Gegencheck</span>
                <span className="font-bold text-text-primary">~0.18 EUR/Monat</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-text-secondary">Marktdaten (Yahoo Finance)</span>
                <span className="font-bold text-text-primary">Kostenlos</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-text-secondary">Datenbank &amp; Auth</span>
                <span className="font-bold text-text-primary">Kostenlos</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-text-secondary">Hosting &amp; Deployment</span>
                <span className="font-bold text-text-primary">Kostenlos</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-border">
                <span className="text-text-secondary">Push Notifications</span>
                <span className="font-bold text-text-primary">Kostenlos</span>
              </div>
              <div className="flex justify-between text-sm py-2 pt-3">
                <span className="text-text-primary font-bold">Gesamt</span>
                <span className="font-black text-text-primary">~1.50&ndash;3.50 EUR/Monat</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed">
            Zum Vergleich: Kommerzielle Signal-Dienste kosten typischerweise 30&ndash;200 EUR/Monat. Tradent erreicht vergleichbare oder bessere Funktionalitaet fuer unter 4 EUR monatlich, weil die gesamte Logik auf modernen, kosteneffizienten Cloud-Diensten aufgebaut ist.
          </p>
        </section>


        {/* Footer */}
        <div className="pt-8 border-t border-border text-center space-y-2">
          <img src="/logo.svg" alt="Tradent" className="h-4 mx-auto opacity-40" />
          <p className="text-xs text-text-muted">
            Tradent &middot; Daily Trade Advisor &middot; Vertraulich
          </p>
        </div>

      </main>
    </div>
  );
}
