export const legalPages = {
  about: { eyebrow: 'Built for people who love stories', title: 'About CineSeya.lk', intro: 'CineSeya.lk brings world-class movie discovery and carefully attributed subtitles together in one fast, readable experience.', sections: [
    ['Cinema, made easier to explore', 'We designed CineSeya.lk around a simple path: discover a title, understand what it is, watch a legitimate trailer and download a compatible subtitle. Sinhala content is a first-class part of the product, alongside an interface intended for audiences everywhere.'],
    ['Responsible access', 'A title page does not imply that CineSeya.lk distributes the full movie. Media controls are available only for operator-owned, licensed or public-domain files that have passed an explicit rights review. Subtitle-only listings still provide metadata, reviews and legitimate external information.'],
    ['Contributor respect', 'Every published subtitle keeps its translator credit, compatible release notes, format, version and verification state visible. Quality matters more than upload volume.'],
  ] },
  privacy: { eyebrow: 'Your information', title: 'Privacy Policy', intro: 'This policy explains the information CineSeya.lk needs to operate and the controls available to visitors and registered members.', sections: [
    ['Information we process', 'Account information, watchlists, ratings, comments, viewing progress for authorized media, subtitle download history and security records may be stored when those features are used. Search and traffic analytics are aggregated wherever practical.'],
    ['Why we process it', 'Information is used to provide requested features, secure accounts, prevent abuse, improve search relevance, understand aggregate service performance and meet legal obligations. Download counters are updated by the server rather than trusted to browser code.'],
    ['Retention and choices', 'Account holders can request access, correction or deletion subject to security, fraud-prevention and legal retention requirements. Anonymous watchlists and recent searches remain in local browser storage until cleared.'],
    ['Advertising and consent', 'CineSeya can show clearly labelled manual advertising placements only after the owner enables live serving and a page passes publication, language, original-content, rights and route reviews. Google advertising services may process device, network and interaction information according to the choices provided by a Google-certified consent management platform. Sinhala-dominant and otherwise ineligible pages do not request AdSense ads.'],
    ['Privacy and cookie settings', 'Where the certified Google consent message applies, a Privacy and cookie settings control is provided in the site footer so visitors can revisit their choices. Browsing and permitted downloads remain available when advertising or consent services cannot run.'],
  ] },
  terms: { eyebrow: 'Using the platform', title: 'Terms of Service', intro: 'These terms set the ground rules for responsible use of CineSeya.lk.', sections: [
    ['Permitted use', 'Use the service for lawful personal discovery and permitted downloads. Do not evade access controls, scrape at abusive volume, upload malicious files, impersonate contributors or interfere with other visitors.'],
    ['Content and availability', 'Metadata and external ratings can change. Subtitle compatibility is described carefully but may vary by release. Full media is offered only where the operator has recorded an appropriate rights status and activated a specific version.'],
    ['Community conduct', 'Comments, ratings and reports must be honest and respectful. CineSeya.lk may moderate content, restrict abusive accounts and preserve audit records needed to investigate misuse.'],
  ] },
  copyright: { eyebrow: 'Creative rights', title: 'Copyright Policy', intro: 'CineSeya.lk respects filmmakers, distributors, subtitle translators and other rights holders.', sections: [
    ['Rights-aware catalogue', 'Every movie, episode and media version carries a rights status. Subtitle-only and unavailable titles never expose full media controls. Owned, licensed and public-domain classifications are reviewed separately from the user interface.'],
    ['Subtitle contributions', 'Contributors should upload only translations they created or are authorized to share. Executable files are prohibited, archives are inspected, and attribution remains attached to published versions.'],
    ['Reporting concerns', 'If you believe content infringes your rights, send a detailed takedown request with the exact URL and a clear explanation. Requests are recorded, reviewed and resolved with an audit history.'],
  ] },
  accessibility: { eyebrow: 'Designed for more people', title: 'Accessibility', intro: 'CineSeya.lk targets WCAG 2.2 AA and treats accessibility as a product quality requirement.', sections: [
    ['Keyboard and screen readers', 'Primary navigation, search, dialogs, forms and media controls are designed for keyboard operation with visible focus states and meaningful labels. Page structure uses semantic headings and landmarks.'],
    ['Visual and motion preferences', 'The dark palette maintains readable contrast, touch targets are sized for mobile use, and nonessential movement is suppressed when reduced motion is requested.'],
    ['Tell us what is not working', 'Accessibility improves through real feedback. Use the contact form with the affected page, browser, assistive technology and a short description of the barrier.'],
  ] },
  contact: { eyebrow: 'Talk to the team', title: 'Contact CineSeya.lk', intro: 'Send a product, contributor, accessibility or general platform question. Do not include passwords, private tokens or payment credentials.', sections: [['What to include', 'Share the relevant title or page URL and enough context for the team to understand the question. Rights-related notices should use the dedicated takedown form.']] },
  takedown: { eyebrow: 'Rights-holder requests', title: 'Takedown Request', intro: 'Submit the exact content URL and the basis for your request. The record enters the Legal / Takedowns review queue.', sections: [['Before submitting', 'Make sure the URL identifies the specific CineSeya.lk page or file. Explain your relationship to the work and provide a contact address where the review team can respond.']] },
} as const;

export type LegalPageKey = keyof typeof legalPages;
