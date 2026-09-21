// Messy, realistic call notes for the three simulated design partners. Each has: a named sponsor,
// a stated metric, at least one commitment, one contradiction or open question, and one aside that
// sounds like a fact but is not evidence (to exercise the verifier).

export const TRANSCRIPTS: Record<string, { label: string; text: string }> = {
  'Fraud signals copilot': {
    label: 'SIU scoping call, Sep 19',
    text: `Northwind Bank, Special Investigations Unit scoping call, Sep 19. Attendees: Dana Whitfield (Head of SIU), Raj Patel (Head of Data Platform), Diego, Linus, Maya.
Dana opened with the problem: investigators spend the first two hours of every case re-reading adjuster notes to find the signals that triggered the referral.
Dana: "If the copilot can surface the three or four reasons a claim was referred, with the source lines, that alone pays for it."
Current volume is about 140 referrals a week across the two regions. Dana wants that reviewed in under 30 minutes per case, down from roughly two hours today.
Raj confirmed SIU case notes live in the same SQL Server 2016 instance as claims, in a separate schema, and that the nightly extract we already run can include it with an InfoSec addendum.
Raj: "I own the box and the extract. The addendum is a two-week process, not a two-day one."
Linus asked who would use it day to day. Dana: the eight senior investigators, then the whole unit if it works.
Dana will be the sponsor and can approve scope for SIU; budget above the current contract needs Helen Marsh.
Open question: whether referral reasons are recorded structurally anywhere or only in free text. Raj thinks there is a legacy referral-code table but nobody has looked at it in years.
Diego raised the second-business-unit expansion; Dana was clear this is a pilot decision for SIU first, not a bank-wide rollout.
Maya asked about a workflow owner. Dana said Tom's counterpart in SIU is Priya Raman, the case intake lead; Priya was not on the call.
Timeline: Dana wants investigators seeing signals before the Q4 fraud audit, so mid-November at the latest.
Linus committed to a data profiling pass on the SIU schema by Friday, assuming read access lands.
Raj committed to filing the InfoSec addendum this week.
Someone mentioned that the legal team had already cleared model use on investigator notes; nobody on the call could confirm that and Dana said she would check.
Scope explicitly excludes: anything that files or closes a case, anything customer-facing, and property claims.
Success criteria per Dana: minutes to first review under 30, and investigators rating the surfaced signals as relevant at least 80 percent of the time in the first month.
Risk Raj flagged: the SIU schema has no primary key on the notes table; deduplication will be on us.
Next call scheduled for Sep 26 with Priya Raman present.`,
  },
  'Outage report summarization': {
    label: 'Bootcamp day 4 wrap-up, Sep 21',
    text: `Helios Energy bootcamp, day four wrap-up. In the room: Mark Delaney (COO), Ines Rocha (Director, Grid IT), two control room shift leads (Sam and Ola), Grace, Maya, Diego.
The summarizer ran on the full September ticket export today: 412 outage tickets, summaries reviewed by Sam and Ola.
Ola: "Out of the forty I checked, I would have published thirty-three as they were."
Mark's target for the demo tomorrow: show the path from 95 minutes to a published report to under 20.
Ines confirmed the SCADA event log integration is read-only and stays inside the plant network; the summarizer runs on the on-prem box Grid IT provisioned on day two.
Ines: "Nothing from SCADA leaves the plant network. That is not negotiable and it is already true today."
Mark asked whether the control room would own this after the bootcamp. Sam said the shift leads would, if the review step stays a human action.
Grace showed the review queue; Ola asked for a one-click "publish as is" which does not exist yet.
Contradiction noted: Mark wants automatic publishing for low-severity outages; Sam and Ola want every report reviewed by a human for the first quarter. Not resolved on the call.
Ines committed to provisioning a second on-prem box for a staging environment by October 3.
Mark committed to bringing the CFO to the day-five demo; contract decision to follow within a week of the demo.
Diego confirmed the proposal covers summarization of outage and planned-maintenance tickets; field dispatch is explicitly out of scope for the first contract.
Open question from Ines: retention. How long do we keep ticket text on the on-prem box? Grid IT policy says 90 days for operational data.
Success metric agreed: median time from ticket close to published report, from 95 minutes today to 20 minutes within eight weeks of go-live.
Secondary metric: share of summaries published without edits, target 70 percent.
Grace flagged that the ServiceNow export Ines sends is a manual CSV; a scheduled export is needed before production.
There was a joke about the plant cafeteria that everyone agreed was the real blocker.
Workflow owner going forward: Sam Ferreira, control room shift lead, day shift.
Technical owner: Ines. Sponsor: Mark.`,
  },
  'Customs document triage': {
    label: 'Technical win call, Sep 20',
    text: `Cobalt Freight, technical win call, Sep 20. Present: Nadia Okonjo (VP Customs Operations), Felix Braun (Head of Engineering), Linus, Diego, Maya.
Nadia summarized the evaluation: the triage prototype classified 1,200 historical customs packets by required action with 91 percent agreement against her team's labels.
Nadia: "Ninety-one is good enough to start on the low-risk lanes. It is not good enough for anything with a tariff dispute."
Felix confirmed the integration path: packets arrive by email into a shared mailbox, then get uploaded to their document system, Docuware. Felix wants us to read from Docuware, not the mailbox.
Felix: "Do not touch the mailbox. Docuware is the system of record."
Volume is around 900 packets a day across four European entry points.
Nadia's metric: hours from packet arrival to broker assignment, currently a median of six hours, target under one hour for low-risk lanes.
Felix asked about deployment: their Kubernetes cluster is on-prem in Rotterdam; nothing leaves the EU.
Felix committed to giving us a namespace and a Docuware service account by September 27.
Nadia committed to naming a broker team lead as the day-to-day owner; she did not name one on the call.
Diego confirmed commercial terms are agreed pending the security questionnaire, which Felix's team is completing.
Open question: what happens to packets the model is unsure about. Nadia wants them routed to a senior broker queue; Felix wants them left in Docuware untouched with a flag. Not resolved.
Linus noted the historical labels came from two brokers who have since left; label quality for the tariff-dispute class is suspect.
Nadia mentioned that their previous vendor had promised a similar system two years ago and never shipped; she said this twice.
Scope for the first three months: the two low-risk lanes (Rotterdam and Antwerp), triage only, no filing.
Risk from Felix: Docuware's API rate limits are undocumented; he has seen throttling at around 200 calls a minute.
Someone said the CFO had already signed the purchase order, but Diego said it is still pending the security review.
Kickoff target: first week of October, provided the namespace is ready.
Felix is the technical owner. Nadia is the sponsor. Workflow owner: to be named.`,
  },
}
