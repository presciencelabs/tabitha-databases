# Initial motivation

Originally created to get the stem of an inflected form of a word, e.g., "took" would not be found in the Ontology
because only the stem, "take", was in the Ontology.  A process known as [lemmatization](https://en.wikipedia.org/wiki/Lemmatization) is needed so "took" will result
in "take" and that stem has a chance to be found.

> Services and existing libraries were considered but maintaining consistency with TBTA's generation process was important, data and rules.

# Extracting word forms from TBTA

1. On a Windows machine, drop `./tbta_cmdline.exe` into an up-to-date `TBTA` dir
1. Run `tbta_cmdline.exe --export-lexical-forms <output directory>`
1. Place all `*.win.txt` files into the `win` directory
1. run `bun transform.ts` (This is also run automatically during the `targets/migrate.ts` migration)

This script will populate `./csv` with the newly transformed files. The TS function scrubs artifacts and formats the outputs to be used in the next `[Project].tbta.sqlite` migration.
