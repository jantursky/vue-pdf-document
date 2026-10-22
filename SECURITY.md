# Security policy

## Supported versions

Only the latest release of `vue-pdf-document` gets fixes.

## Reporting a vulnerability

Please don't open a public issue. Use GitHub's [private vulnerability reporting](https://github.com/jantursky/vue-pdf-document/security/advisories/new), or email jan.tursky@gmail.com with a description and, if you can, a minimal reproduction.

You'll get an answer within a week. Once a fix is released, the advisory is published with credit, unless you'd rather stay anonymous.

Issues in the layout engine or pdfkit should also go to [react-pdf](https://github.com/diegomura/react-pdf/security) or [pdfkit](https://github.com/foliojs/pdfkit).

## Things to know

- Documents are rendered from the data you pass in. If that data comes from users, it ends up in the PDF as text; it isn't executed.
- Remote image and font URLs are fetched during layout. Don't build them from untrusted input without validating the host.
- `userPassword` and `ownerPassword` use pdfkit's encryption. Owner permissions are advisory and many viewers ignore them.
