---
name: ste-writing
description: Write or rewrite prose in ASD-STE100 Simplified Technical English to remove AI slop. Use for every .md file, vault capture entry, INBOX entry, PR description, Linear comment, Slack message, commit message, release note, error message, and code comment. Also use when asked to make writing plain, clear, human, or less like AI, or to enforce a controlled writing style. Three modes: strict, standard, and off.
---

# ste-writing

Write prose in ASD-STE100 Simplified Technical English (STE). STE is a controlled
language from the aerospace industry. It has 53 writing rules and a dictionary of
about 900 approved words. It exists to make technical text unambiguous for readers
who are not native English speakers. It also removes the register that makes text
read as machine-generated.

Canonical copy of this skill: `~/Documents/Git/GoodUnited/repos/.claude/skills/ste-writing/`.
Copies exist in the vault, SCuLPT, and aristaeus. Edit the canonical copy first, then
copy it to the other three.

## 1. Where this applies

Apply STE to:

- Every `.md` file in the vault, in `1-capture/`, `2-process/`, and `3-surface/`
- Every INBOX entry
- Every PR description, PR review comment, and commit message body
- Every Linear comment, Linear issue description, and Linear document
- Every Slack message that carries technical content
- Every README, runbook, docstring, and code comment
- Every user-visible error message and log message

Do not apply STE to:

- Code, identifiers, command syntax, SQL, config keys, or file paths
- Quoted text from another source. Quote it exactly.
- Chat replies in the terminal to the user. Those are conversation, not documentation.
- Creative or voice-driven text. Examples: the SCuLPT poster copy, essays, artist
  statements, and marketing copy. STE removes voice on purpose. Use mode `off` and
  say that you did.

## 2. Modes

| Mode | Use for | What it means |
|---|---|---|
| `strict` | Runbooks, procedures, safety text, error messages, migration steps | Every rule. Both word caps. Imperative form. One instruction per sentence. |
| `standard` | Vault notes, INBOX entries, PR descriptions, Linear comments, READMEs, docstrings | Every mechanical rule below. The 900-word dictionary is a target, not a lock. Keep enough range to read naturally. |
| `off` | Creative and voice-driven text | No STE. Say in your reply that you turned STE off, and why. |

Default to `standard`. Move to `strict` when the text tells a reader to do something
and a mistake has a cost.

## 3. The rules

### Words (STE section 1, rules 1.1 thru 1.14)

- Use one name for one thing. Do not call the same item two different names. If the
  repo calls it a `campaign`, do not also call it a drive or an initiative.
- Give each word one meaning. "Fall" means to move down. It does not mean to decrease.
- Use the short common word. Replace the long word:

  | Do not use | Use |
  |---|---|
  | `begin`, `commence`, `initiate` | `start` |
  | `utilize`, `leverage` | `use` |
  | `facilitate` | `help` |
  | `ensure` | `make sure` |
  | `prior to` | `before` |
  | `subsequent to` | `after` |
  | `regarding`, `concerning`, `with respect to` | `about` |
  | `obtain`, `acquire` | `get` |
  | `demonstrate` | `show` |
  | `additionally`, `furthermore`, `moreover` | `also` |
  | `in order to` | `to` |
  | `due to the fact that` | `because` |
  | `in the event that` | `if` |
  | `a variety of`, `numerous`, `myriad`, `plethora` | `many`, `or a number` |
  | `terminate` | `stop`, `or end` |
  | `attempt` | `try` |
  | `approximately` | `about` |
  | `sufficient` | `enough` |
  | `comprehensive` | `complete`, `or full` |
  | `whilst` | `while` |
  | `amongst` | `among` |

- Use no marketing adjective. Examples: `seamless`, `robust`, `powerful`, `elegant`, `cutting-edge`, `effortless`, `world-class`, `next-generation`, `revolutionary`, `battle-tested`, `first-class`, `turnkey`, `blazing`, `delightful`, `game-changing`.
- Use no marketing verb. Examples: `unlock`, `unleash`, `empower`, `supercharge`, `dive into`, `delve into`, `showcase`, `underscore`.
- Use American English spelling.
- Do not use a technical noun as a verb. Do not write "we inboxed the entry". Write
  "we appended the entry to INBOX".

### Multi-word nouns (STE section 2, rules 2.1 and 2.2)

- Use a maximum of three words in a multi-word noun. `Runway light connection` is
  correct. `Runway light connection resistance calibration` is not.
- When a real term needs more than three words, write it in full one time. Then give
  a short form, or connect the joined words with hyphens. Example: write
  "one-click fundraiser webhook handler" one time, then write "the handler".

### Verbs (STE section 3, rules 3.1 thru 3.7)

- Use only these verb forms: the infinitive, the imperative, the simple present, the
  simple past, the simple future, and the past participle as an adjective.
- Do not stack auxiliary verbs. Do not write "it is important to note that this may
  help to improve latency". Write "this reduces latency".
- Use the "-ing" form only as a noun or as a modifier. Do not use it as the main verb.
  Do not write "the job is running the sync". Write "the job runs the sync".
- Use the active voice. Write "the parser reads the file". Do not write "the file is
  read by the parser". Use the passive voice only in descriptive text, and only when
  the actor is unknown.
- Use a verb for an action, not a noun. Write "analyze the log". Do not write "perform
  an analysis of the log". Do not write "provide support for". Write "support".

### Sentences (STE section 4, rules 4.1 thru 4.5)

- Write short sentences with a clear structure.
- Do not omit words to make a sentence short. Do not use contractions. Write "do not",
  not `don't`.
- Use an article (the, a, an) or a demonstrative adjective (this, these) before a noun.
  Write "the retry runs after the timeout". Do not write "retry runs after timeout".
- Use a vertical list for complex text.
- Use a connecting word to join sentences on a related topic.

### Procedures (STE section 5, rules 5.1 thru 5.5, mode `strict`)

- Use a maximum of 20 words in each sentence.
- Write one instruction in each sentence. Two instructions can share a sentence only
  when the two actions occur at the same time.
- Write each instruction in the imperative form.
- Put a condition before its command. Divide the condition from the command with a
  comma. Example: "If the migration fails, restore the snapshot."
- Write a note only to give information. A note must not contain an instruction.
- Use a numbered vertical list for steps. Use one action for each item.

### Descriptive text (STE section 6, rules 6.1 thru 6.6)

- Use a maximum of 25 words in each sentence.
- Give information one step at a time. Put the context before the detail.
- Use key words and headings to give the text a logical structure.
- Give each paragraph one topic.
- Use a maximum of six sentences in each paragraph.

### Safety and risk text (STE section 7, rules 7.1 thru 7.3)

- Use a word that shows the level of risk. A warning shows a risk of injury. A caution
  shows a risk of damage. In this codebase, a caution covers data loss, a destructive
  migration, and a production write.
- Start the text with a clear command or a clear condition.
- Then give the reason, the risk, or the result.

Example: "Caution: Do not run the backfill against production. The job writes to
`transactions` and has no rollback."

### Punctuation (STE section 8, rules 8.1 thru 8.7)

- Do not use a semicolon. Write two sentences.
- Do not use an em dash (`—`) or an en dash (`–`) in prose. STE permits the em dash. This
  project bans it, because em-dash density is the clearest machine-generated tell.
  Replace it with a period, a comma, a colon, or parentheses.
- Use a hyphen to join words that are directly related.
- Use parentheses for a reference, an abbreviation, or a short explanation.
- Word count treats each of these as one word: a number, a number with its unit, an
  abbreviation, an alphanumeric identifier, quoted text, a heading, a proper noun, a
  hyphenated word, and any text inside parentheses. A colon in a vertical list ends a
  sentence, the same as a period.

### Writing practice (STE section 9, rules 9.1 thru 9.4)

- Do not make a phrasal verb from two words. Replace it:

  | Do not use | Use |
  |---|---|
  | `spin up` | `start`, `or create` |
  | `tear down` | `remove`, `or delete` |
  | `reach out` | `ask`, `or contact` |
  | `kick off` | `start` |
  | `roll out` | `release`, `or deploy` |
  | `ramp up` | `increase` |
  | `circle back` | `return to` |
  | `drill down` | `examine in detail` |
  | `dive into` | `examine`, `or read` |
  | `look into` | `examine` |
  | `figure out` | `find`, `or determine` |

- Rewrite the whole sentence when a word-for-word replacement reads badly. Rule 9.1
  permits a new construction. It does not permit a bad sentence.
- Keep one style for terminology across a document and across linked documents.
- Use no hedge phrase. Delete these: `it is important to note`, `it should be noted`, `it is worth noting`, `please note that`, `as mentioned above`, `arguably`, `in some sense`, `that said`, `at the end of the day`.
- Do not write a `not only X but also Y` construction. Do not write a rule of three for
  rhythm. Do not close a document with a summary of what the document already said.

## 4. Self-lint

Run this check before you return or save any text.

1. Any sentence over 20 words in a procedure, or over 25 in descriptive text? Split it.
2. Any semicolon? Replace it with a period.
3. Any em dash or en dash? Replace it.
4. Any contraction? Expand it.
5. Any passive voice with a known actor? Make it active.
6. Any "-ing" main verb, any nominalization such as "perform an analysis", or any
   phrasal verb? Replace it with a plain verb.
7. Any marketing adjective or hedge phrase? Delete it.
8. Any multi-word noun over three words? Shorten it, or hyphenate it.
9. Any paragraph over six sentences, or with two topics? Split it.
10. Same thing named two ways? Pick one name and use it everywhere.
11. Any missing article? Add it.

Then run the linter on the file:

```
python3 ~/Documents/Git/GoodUnited/repos/.claude/skills/ste-writing/ste-lint.py <file>
```

The score is violations for each 100 words. A lower score is cleaner. Target 1.5 or
less for a new document. Lint the draft, apply this skill, then lint again. The delta
between the two scores is the signal.

The linter checks the mechanical subset of STE. It cannot check the judgment rules,
such as the correct technical noun, or whether a sentence makes good sense. It fixes
the form of slop. It cannot make a hollow paragraph true.

## 5. What this skill does not fix

STE controls form. It does not supply content. A short, active, plain sentence that
says nothing is still slop. Write the fact, the reason, and the constraint. Then apply
these rules to the words.

Reference: ASD-STE100 Issue 9, 2025-01-15. Free download at https://asd-ste100.org.
The standard is copyrighted. Do not paste it in full into any file or any comment.
