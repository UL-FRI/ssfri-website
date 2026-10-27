# Študentski svet FRI – spletna stran

Statična spletna stran, zgrajena z [Eleventy](https://www.11ty.dev/). Vsa vsebina je v mapi `content/`. Spremembe objaviš tako, da datoteke dodaš ali spremeniš pushaš v repo (če imaš dostop) ali narediš pull request (če nimaš dostopa). Pull requesti so uporabni tudi za preview deploymente, ko se delajo kake večje spremembe.

```
content/
  pages/       strani (fiksne, nekronoliške)
  articles/    novice (kronološko urejene)
  documents/   dokumenti: zapisniki, pravilniki, …
```

# Izgradnja strani

Potrebuješ Node.js 22 ali novejši. Za iskanje po dokumentih sta potrebna še `pdftotext` (paket `poppler-utils`) in `pandoc` (tega ne rabiš lokalno če samo urejaš vsebino)

```sh
# Namesti potrebne NodeJS pakete (samo prvič)
npm install
# Zažene lokalni live reloading strežnik
npm start
# Naredi končni build (da preveriš če se ni kaj pokvarlo, dejanski build se zgodi v CI)
npm run build
```

Indeks za iskanje (Pagefind) se zgradi šele v končnem buildu, v razvojnem strežniku iskanje ne deluje.

# Objavljanje

Po vsaki spremembi preveri stran z `npm start` ali `npm run build`.

## Objava novice

Novica je markdown datoteka v `content/articles/`. Ime se začne z datumom: `LLLL-MM-DD-kratek-naslov`. Datum v imenu ni del naslova strani, leto pa je del povezave (nova novica bo na `/novice/LLLL/kratek-naslov/`). Uvožene novice in strani s poljem `source:` v glavi ostanejo na svoji stari povezavi.

Če nima prilog jo narediš kot datoteko v mapi, npr. `content/articles/2026-03-01-nova-novica.md`:

```markdown
---
title: "Naslov novice"
date: "2026-03-01"
---

Besedilo novice v **markdownu**.
```

Če ima novica slike ali priloge, naredi mapo namesto datoteke, v njo daj `index.md` in priloge, npr.:

```
content/articles/2026-03-01-nova-novica/
  index.md
  plakat.jpg
  prijavnica.pdf
```

V besedilu se nanje sklicuješ z imenom datoteke:

Feature image nastaviš z `image: "plakat.jpg"` v glavi `index.md`.

## Objava strani

Stran je markdown datoteka v `content/pages/`, poimenovana `LLLL-MM-DD-naslov.md`:

```markdown
---
title: "Naslov strani"
date: "2026-03-01"
---

Vsebina strani.
```

Priloge in slike delujejo enako kot (mapa z `index.md`).

Stran se v meniju prikaže samo, če ima v glavi `menu: N` (številka določa vrstni red).

Povezava na drugo stran ali novico je relativna pot do njene `.md` datoteke ali mape (npr. z novice: `../pages/2014-12-19-kontakt.md`.

## Objava zapisnika

Zapisniki so v `content/documents/Zapisniki/Mandat LLLL-LL/`. Datoteko (PDF ali DOCX) samo dodaš v mapo mandata.

Ime datoteke mora biti v formatu `[LLLL]-[MM]-[DD] [ŠŠ] [Tip dokumenta].[ext]`.

- `LLLL-MM-DD` je datum seje v ISO formatu,
- `ŠŠ` je zaporedna številka seje (`01`, `02`, ...) - lahko je ni (npr. konstitutivna seja),
- `Tip dokumenta` je ponavadi `Zapisnik [tip] seje` (redne, izredne, dopisne, konstitutivne).

Primer: `2026-02-09 03 Zapisnik redne seje.pdf`.

### Zapisnik s prilogami

Če ima zapisnik priloge, naredi mapo z imenom zapisnika (brez končnice) in vanjo daj zapisnik ter priloge. Vse datoteke se začnejo z imenom mape:

```
Mandat 2025-26/
  2026-03-01 04 Zapisnik redne seje/
    index.md
    2026-03-01 04 Zapisnik redne seje.pdf
    2026-03-01 04 Zapisnik redne seje - Priloga 1 Finančno poročilo.pdf
    2026-03-01 04 Zapisnik redne seje - Priloga 2.pdf
```

V neobvezen `index.md` lahko napišeš dodatno besedilo, ki se prikaže nad seznamom datotek. Enako velja za vsako mapo v `documents/`: `index.md` doda besedilo, seznam datotek se izpiše vedno.
