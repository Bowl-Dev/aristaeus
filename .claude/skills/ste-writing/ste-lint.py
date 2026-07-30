"""STE linter for the GoodUnited vault and sibling repos.

Adapted from woosal1337/blog ep01. Local changes:
  - em dash and en dash count as violations, not as an informational marker
  - extra banned words, phrasal verbs, and hedges from the ste-writing skill
  - descriptive sentence cap raised to 25 words, procedure cap kept at 20
    (pass --strict to apply the 20-word cap to the whole file)

Usage:
  python3 ste-lint.py FILE [FILE ...]     one summary line for each file
  python3 ste-lint.py --json FILE         full violation breakdown
  python3 ste-lint.py --strict FILE       20-word cap everywhere
  cat draft.md | python3 ste-lint.py      read from stdin, print JSON
"""
import re, sys, json, glob, os

MARKETING = ["seamless","seamlessly","robust","powerful","cutting-edge","effortless","effortlessly",
    "world-class","next-generation","revolutionary","blazing","lightning-fast","elegant","delightful",
    "turnkey","best-in-class","state-of-the-art","game-changing","first-class","battle-tested",
    "enterprise-grade","supercharge","unlock","unleash","empower","empowers","frictionless",
    "bulletproof","rock-solid","industry-leading","holistic","synergy","paradigm"]
BANNED = ["begin","begins","commence","commences","initiate","initiates","originate",
    "utilize","utilizes","utilizing","leverage","leverages","leveraging","facilitate","facilitates",
    "ensure","ensures","ensuring","prior to","subsequent to","obtain","obtains","acquire","acquires",
    "demonstrate","demonstrates","additionally","furthermore","moreover","comprehensive","comprehensively",
    "utilization","aforementioned","henceforth","therein","whilst","amongst","numerous","myriad","plethora",
    "in order to","a variety of","in the event that","due to the fact that","it is important to note",
    "terminate","terminates","attempt","attempts","approximately","sufficient","endeavor",
    "regarding","concerning","with respect to","with regard to","nevertheless","nonetheless",
    "thus far","a number of things","various","vast","robustly","seamless integration",
    "not only","delve","delves","delving","crucial","pivotal","vital","key to","testament to",
    "landscape","realm","tapestry","underscore","underscores","showcase","showcases"]
PHRASAL = ["spin up","spin down","reach out","dive into","dives into","diving into","kick off","kicks off",
    "roll out","rolls out","tear down","ramp up","circle back","drill down","spun up","reaching out",
    "look into","looks into","figure out","figures out","sort out","set up a","stand up a",
    "wire up","hook up","plug in","surface up","bubble up","lean into","double down"]
MODAL_HEDGE = ["it is important to note","it should be noted","it is worth noting","please note that",
    "as mentioned","as noted above","as we can see","it turns out that","arguably","in some sense",
    "generally speaking","broadly speaking","that said","that being said","at the end of the day"]
BE = r"(?:am|is|are|was|were|be|been|being)"
PP_IRREG = r"(?:done|made|sent|read|built|kept|held|set|put|run|written|shown|given|taken|found|got|gotten|seen|known|thrown|drawn)"

def strip_code(t):
    t = re.sub(r"```.*?```", " ", t, flags=re.S)
    t = re.sub(r"`[^`]*`", " ", t)
    return t

def strip_quotes(t):
    """Drop double-quoted spans. STE rule 8.6 counts quoted text as one word, and a
    document that teaches STE has to quote the wrong form to name it."""
    return re.sub(r"\"[^\"\n]{0,200}\"", " QUOTED ", t)

def is_list_block(para):
    """True when most items of a block are list items or table rows. A vertical list is
    rule 4.3 behavior, not a paragraph, so the six-sentence cap does not apply.

    An indented line with no marker is a wrapped continuation of the item above it, so
    fold it into that item before counting. Without this, any hard-wrapped list reads as
    a long paragraph.
    """
    items, marked, seen_marker = 0, 0, False
    for line in para.split("\n"):
        if not line.strip():
            continue
        if re.match(r"^\s*(?:[-*+]|\d+[.)]|\|)", line):
            items += 1
            marked += 1
            seen_marker = True
        elif seen_marker and re.match(r"^\s+\S", line):
            continue  # wrapped continuation of the item above
        else:
            items += 1
            seen_marker = False
    if not items:
        return False
    return marked >= max(2, items // 2)

def sentences(text):
    out = []
    for line in text.split("\n"):
        s = line.strip()
        if not s: continue
        s = re.sub(r"^\s*#{1,6}\s*", "", s)
        s = re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", "", s)
        if not s: continue
        parts = re.split(r"(?<=[.!?:])\s+(?=[A-Z0-9\"'\-])", s)
        for p in parts:
            p = p.strip()
            if p: out.append(p)
    return out

def wc(s):
    return len([w for w in re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-/]*", s)])

def count_ci(text, phrases):
    n = 0; hits = []
    low = text.lower()
    for ph in phrases:
        for m in re.finditer(r"(?<![a-z])" + re.escape(ph) + r"(?![a-z])", low):
            n += 1; hits.append(ph)
    return n, hits

# Any function word, quantifier, or common verb breaks a multi-word noun. A real
# check needs the STE dictionary, so keep this list wide and accept under-reporting.
MWN_STOP = set("""a an the and or but so nor yet of to in on for with from by at as into onto over
under after before between during through per via than then when where while if unless until because
this that these those it its you your we our they their he she his her them us me my
is are was were be been being am do does did done have has had having
can could may might must shall should will would need needs let lets
not no all any both each every few many more most much other some such only own same too very
one two three four five six seven eight nine ten first second next last new old good bad
use uses used using make makes made get gets got give gives gave take takes took put puts
run runs ran read reads reading write writes wrote show shows shown keep keeps kept
say says said see sees seen know knows known find finds found want wants like likes
add adds added remove removes set sets sent send sends call calls called
here there now also just still even again once always never often sometimes
example examples note notes way ways thing things time times case cases
word words words. above below within without across against among along around
maximum minimum
""".split())

def long_multiword_nouns(text):
    """Heuristic: 4+ consecutive lowercase content words with no function word.

    Catches 'runway light connection resistance calibration'. Deliberately
    conservative, since a real check needs the STE dictionary. Under-reports
    rather than over-reports, so a hit is worth looking at.
    """
    hits = []
    for m in re.finditer(r"\b(?:[a-z][a-z\-]{2,}\s+){3,}[a-z][a-z\-]{2,}\b", text):
        run = m.group(0).split()
        if len(run) > 7:
            continue
        if any(w.strip(".,") in MWN_STOP for w in run):
            continue
        # -ly/-ed/-ing signal an adverb or a finite verb, not a noun stack
        if any(w.endswith(("ly", "ed", "ing")) for w in run):
            continue
        hits.append(m.group(0))
    return hits

def lint(text, strict=False):
    raw = text
    text = strip_quotes(strip_code(text))
    sents = sentences(text)
    words = sum(wc(s) for s in sents) or 1
    cap = 20 if strict else 25
    v = {}
    longs = [(wc(s), s) for s in sents if wc(s) > cap]
    v[f"long_sentence(>{cap}w)"] = len(longs)
    v["semicolon"] = text.count(";")
    v["em_dash"] = text.count("—") + text.count("–")
    mwn = long_multiword_nouns(text)
    v["long_multiword_noun(>3w)"] = len(mwn)
    # 's is usually possessive, which STE allows. Only count the true 's contractions.
    v["contraction"] = (
        len(re.findall(r"\b\w+['’](?:t|re|ve|ll|m)\b", text))
        + len(re.findall(r"\b(?:it|that|there|here|he|she|what|who|let|which|one)['’]s\b",
                         text, re.I)))
    v["passive_voice"] = len(re.findall(rf"\b{BE}\s+(?:\w+ed|{PP_IRREG})\b", text, re.I))
    v["ing_main_verb"] = len(re.findall(rf"\b{BE}\s+\w+ing\b", text, re.I))
    v["nominalization"] = len(re.findall(r"\b(?:perform(?:s|ed)?|conduct(?:s|ed)?|provide(?:s|d)?|carry out|carries out|make use of|makes use of)\b", text, re.I)) + len(re.findall(r"\b\w{4,}(?:tion|ment|ance|ence)\s+of\b", text, re.I))
    v["phrasal_verb"], _ = count_ci(text, PHRASAL)
    v["banned_word"], bh = count_ci(text, BANNED)
    v["marketing_adjective"], mh = count_ci(text, MARKETING)
    v["modal_hedge"], _ = count_ci(text, MODAL_HEDGE)
    paras = [p for p in re.split(r"\n\s*\n", raw) if p.strip() and not is_list_block(p)]
    v["long_paragraph(>6s)"] = sum(
        1 for p in paras if len(sentences(strip_quotes(strip_code(p)))) > 6)
    total = sum(v.values())
    return {
        "words": words, "sentences": len(sents),
        "mode": "strict" if strict else "standard",
        "violations": {k: x for k, x in v.items() if x},
        "total": total,
        "total_per100w": round(total*100.0/words, 2),
        "longest_sentence_words": (max(longs)[0] if longs else max((wc(s) for s in sents), default=0)),
        "sample_marketing": list(dict.fromkeys(mh))[:6],
        "sample_banned": list(dict.fromkeys(bh))[:6],
        "sample_multiword_noun": list(dict.fromkeys(mwn))[:4],
    }

if __name__ == "__main__":
    argv = sys.argv[1:]
    strict = "--strict" in argv
    as_json = "--json" in argv
    files = [a for a in argv if not a.startswith("--")]
    if not files:
        print(json.dumps(lint(sys.stdin.read(), strict), indent=2)); sys.exit(0)
    exp = []
    for f in files: exp += sorted(glob.glob(f)) if any(c in f for c in "*?[") else [f]
    worst = 0.0
    for f in exp:
        with open(f) as fh: r = lint(fh.read(), strict)
        worst = max(worst, r["total_per100w"])
        if as_json:
            print(json.dumps({"file": f, **r}, indent=2))
        else:
            print(f"{os.path.basename(f):36} words={r['words']:5d} total={r['total']:3d} "
                  f"per100w={r['total_per100w']:6.2f} longest={r['longest_sentence_words']:3d}")
    # exit 1 when any file is over the target, so a hook or CI step can gate on it
    sys.exit(1 if worst > 1.5 else 0)
