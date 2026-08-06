# Internet Systems Consortium (ISC) — research
Provider/key: bamboohr:isc | company_type: product (non-profit open-source infrastructure)

Note on identity: the registry stores this company as `isc` (lowercase, no display name), which is
ambiguous — "ISC" also matches ISC2 (cybersecurity certification body), Integrated Specialty
Coverages (insurance), and ISC / Information Services Corporation of Saskatchewan. The entity behind
`isc.bamboohr.com/careers` is confirmed as **Internet Systems Consortium** by the live posting
itself, which is for a BIND 9 engineer and links to https://www.isc.org.

What they do: ISC is a US 501(c)(3) non-profit public benefit corporation, founded 1994 and
incorporated in Delaware (2004), that develops and maintains core open-source Internet
infrastructure software. Its flagship projects are **BIND 9** — the most widely deployed DNS server
on the Internet, used by DNS root operators, ISPs and global enterprises, and the reference
implementation of the IETF DNS standards — plus **Kea DHCP** and the legacy ISC DHCP. Since 1994 it
has also operated **F-Root**, one of the 13 Internet root name servers, as a public service. ISC
staff actively participate in the IETF and help write the DNS standards their software implements.

How they describe themselves: "dedicated to developing software and offering services in support of
the Internet infrastructure", with an explicit commitment to open source so that critical Internet
functions stay independent of any entity that might exploit them. Its Code of Conduct is the stated
values document: "be friendly and patient", "create a welcoming environment", "demonstrate
consideration and respect", "practice kindness". The BIND 9 job posting's own framing is about
"building reliable software that keeps the Internet running smoothly" and being "a core contributor
to a highly impactful, open-source project that powers a critical part of the global Internet
infrastructure". No growth, hustle, or disruption language anywhere.

Size / stage / funding: small non-profit (order of tens of staff, not hundreds). Revenue model is
selling software **support contracts** to enterprises and organisations that depend on the free open
source software, supplemented by sponsorship/donations. Not VC-funded, no runway or exit pressure —
but also no equity upside and a non-profit pay ceiling. 30+ years old; about as stable and "boring"
as software organisations get.

Locations / HQ: registered HQ address in Newmarket, New Hampshire, USA (Internet Systems
Corporation, the Delaware operating subsidiary). There is effectively no office culture — staff are
distributed across Australia, Poland, the UK, France, the Czech Republic, Bulgaria, Brazil, Denmark,
Austria, the Netherlands, and the US states of Alaska, California, Delaware, New Hampshire, North
Carolina, Virginia and Washington.

Remote policy: fully remote and has been "for years" — this is a genuinely remote-native
organisation, not a pandemic convert. Their own write-up describes: no monitoring of hours, a focus
on "results rather than activity"; meeting times rotated week to week so the same people aren't
always taking the awkward slot; Doodle polls to find mutually workable times; Zoom for video;
Etherpad for shared agendas and collaborative notes anyone can comment on; Mattermost chat with
persistent history explicitly so people in other timezones can catch up asynchronously; and a weekly
all-staff news email summarising each department. That is a documented async/handbook culture.

Remote-Canada eligibility: **Verified yes, explicitly.** The BIND 9 Software Engineer posting states
under "Location & Work/Life Balance": "Location: Schengen Area States, European Union (+EFTA and
EEA), United Kingdom, **Canada**." It adds "Although ISC is located in the US, our staff works
globally from their homes", "With staff across many time zones, there are no rigid set hours. We
expect a 40-hour work week, but you have the autonomy to design your schedule within manager
parameters (e.g. establishing overlap for team meetings)", and "Travel to the USA will not be
required" (occasional international travel to North America/Europe for company meetings or
conferences is required). Mountain Time is workable given the rotating-meeting practice, though note
the staff centre of gravity is Europe, so some early-morning MT overlap is likely.

Engineering & tech: BIND 9 is written in **C11/C17** on Unix/BSD/Linux; the role wants strong
procedural/OO programming (C, C++, Rust) and modern-C readiness. Their stated toolchain is
deeply systems-flavoured: Address Sanitizer and Thread Sanitizer, Autotools and meson, Clang Static
Analyzer, Coverity, cmocka, GDB, rr, perf, Wireshark, libuv (network programming), OpenSSL
(cryptography), Userspace-RCU (multiprocessor programming), pytest and Python, Git/GitLab, GnuPG,
Debian and RPM/mock packaging, Docker, QEMU/libvirt/Packer, Sphinx-doc, ShellCheck, and their own
DNS test tooling (DNS Shotgun, Flamethrower, respdiff). Development is public on GitLab
(gitlab.com/isc-projects/bind9) and mirrored to GitHub. The work described is: designing and
building BIND 9 features, constructive code review, investigating bug reports from a global user
community, release engineering and project planning, an on-call escalation rotation (only after
onboarding/training), and representing ISC at the IETF.

Notable / other: hiring language is deliberately low-barrier ("underrepresented groups are less
likely to apply unless they meet exactly all requirements... we encourage you to apply"),
educational requirements are explicitly flexible about non-traditional paths, and the posting calls
the role "highly suitable for home working and for parents or caregivers". Job-application data is
processed in the USA by a third-party processor. Their public careers page (isc.org/careers) is
often empty even when the BambooHR board has an opening — check BambooHR directly.

Open relevant roles (sample): BIND 9 Software Engineer (https://isc.bamboohr.com/careers/21).

Sources:
- https://www.isc.org/about/
- https://www.isc.org/blogs/remote_working_at_isc/
- https://www.isc.org/careers/
- https://isc.bamboohr.com/careers/21 (live JD text held locally)
- https://en.wikipedia.org/wiki/Internet_Systems_Consortium
