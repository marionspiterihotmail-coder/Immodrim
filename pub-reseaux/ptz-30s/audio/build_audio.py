"""Bande son de la pub PTZ Immodrim (30 s, 120 BPM).

Produit dans assets/audio/ :
  vo.wav   la voix off calée sur le montage (une phrase par scène)
  bed.wav  musique + bruitages, déjà « duckés » sous la voix
  mix.wav  les deux mixés (référence d'écoute)

Pour remplacer la voix (ex. voix Google Flow / Gemini) : déposer un fichier
par phrase dans assets/vo/l1.wav … l8.wav puis relancer ce script.
Toute la synthèse est déterministe (graine fixe).
"""
import os
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import butter, sosfilt, resample_poly
from scipy.ndimage import minimum_filter1d

SR = 48000
DUR = 30.0
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
N = int(SR * DUR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO_DIR = os.path.join(ROOT, "assets", "vo")
OUT = os.path.join(ROOT, "assets", "audio")
rng = np.random.default_rng(7)

# Début de chaque phrase (s) : doit rester cohérent avec index.html
VO_STARTS = [0.35, 3.15, 8.15, 11.6, 14.6, 18.1, 20.65, 25.8]
# Coupes de scènes (whoosh juste avant)
CUTS = [3.0, 8.0, 11.5, 14.5, 18.0, 20.5, 25.5]


def t_arr(n):
    return np.arange(n) / SR


def place(buf, sig, at, gain=1.0):
    i = int(round(at * SR))
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def bp(sig, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), sig)


def hp(sig, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), sig)


def lp(sig, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), sig)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ---------- instruments ----------
def kick():
    n = int(0.35 * SR)
    t = t_arr(n)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 9)
    click = rng.standard_normal(n) * np.exp(-t * 300) * 0.25
    return s + hp(click, 2000)


def clap():
    n = int(0.25 * SR)
    t = t_arr(n)
    env = np.exp(-t * 22)
    for d in (0.0, 0.011, 0.022):  # petits ré-déclenchements « clap »
        env += np.where(t >= d, np.exp(-(t - d) * 120), 0) * 0.6
    return bp(rng.standard_normal(n), 900, 5000) * env * 0.5


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    t = t_arr(n)
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (18 if open_ else 80))


def saw(freq, n):
    t = t_arr(n)
    out = np.zeros(n)
    for k in range(1, 12):
        if freq * k > SR / 2.2:
            break
        out += np.sin(2 * np.pi * freq * k * t) / k
    return out


def bass_note(note, length):
    n = int(length * SR)
    t = t_arr(n)
    s = saw(midi(note), n) * 0.6 + np.sin(2 * np.pi * midi(note) * t) * 0.8
    env = np.minimum(1, t / 0.005) * np.exp(-t * 3.5)
    return lp(s, 900) * env


def pluck(note, length=0.32):
    n = int(length * SR)
    t = t_arr(n)
    f = midi(note)
    s = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t)
         + 0.12 * np.sin(2 * np.pi * 3 * f * t))
    return s * np.minimum(1, t / 0.003) * np.exp(-t * 11)


def pad(notes, length):
    n = int(length * SR)
    t = t_arr(n)
    s = np.zeros(n)
    for nt in notes:
        for det in (-0.08, 0.0, 0.08):
            s += saw(midi(nt + det), n) * 0.18
    env = np.minimum(1, t / 0.25) * np.minimum(1, (length - t) / 0.3).clip(0, 1)
    return lp(s, 1800) * env


def whoosh(length=0.55, rising=True):
    n = int(length * SR)
    t = t_arr(n)
    noise = rng.standard_normal(n)
    # balayage de filtre approximé par fondu entre bandes
    lo = bp(noise, 300, 1200)
    hi = bp(noise, 2500, 9000)
    x = t / length
    mix = x if rising else 1 - x
    env = np.sin(np.pi * np.clip(x, 0, 1)) ** 2
    if rising:
        env = x ** 2.2 * (1 - np.clip((x - 0.92) / 0.08, 0, 1))
    return (lo * (1 - mix) + hi * mix) * env


def impact():
    n = int(1.2 * SR)
    t = t_arr(n)
    f = 38 + 80 * np.exp(-t * 14)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    crack = bp(rng.standard_normal(n), 800, 6000) * np.exp(-t * 18) * 0.5
    return boom + crack


def tick():
    n = int(0.04 * SR)
    t = t_arr(n)
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 160)


def chime(notes, at_gain=1.0):
    n = int(1.6 * SR)
    t = t_arr(n)
    s = np.zeros(n)
    for i, nt in enumerate(notes):
        d = int(i * 0.07 * SR)
        f = midi(nt)
        tone = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.01 * f * t)) * np.exp(-t * 4)
        s[d:] += tone[: n - d]
    return s * at_gain


# ---------- arrangement ----------
# C  G  Am  F  (une mesure de 2 s chacun)
PROG = [(48, [60, 64, 67, 71]), (43, [59, 62, 67, 69]), (45, [57, 60, 64, 67]), (41, [57, 60, 65, 69])]
ARP = [0, 2, 1, 3, 2, 1, 3, 2]

drums = np.zeros(N)
bass = np.zeros(N)
keys = np.zeros(N)
pads = np.zeros(N)
sfx = np.zeros(N)
pump = np.ones(N)

K = kick()
nbars = int(np.ceil(DUR / BAR))
for b in range(nbars):
    t0 = b * BAR
    root, chord = PROG[b % 4]
    end_section = t0 >= 25.5  # carte de fin : on retire la rythmique
    for beat in range(4):
        tb = t0 + beat * BEAT
        if tb >= DUR:
            continue
        in_break = 17.5 <= tb < 18.0
        if not end_section and not in_break and tb >= 0.0:
            place(drums, K, tb, 0.9)
            i = int(tb * SR)
            j = min(N, i + int(0.22 * SR))
            pump[i:j] = np.minimum(pump[i:j], 0.45 + 0.55 * np.linspace(0, 1, j - i) ** 0.6)
            if beat in (1, 3) and tb >= 3.0:
                place(drums, clap(), tb, 0.55)
            place(drums, hat(open_=(beat == 3 and b % 2 == 1)), tb + BEAT / 2, 0.22)
            if tb >= 8.0:  # 16es de charleston pour monter l'énergie
                place(drums, hat(), tb + BEAT / 4, 0.09)
                place(drums, hat(), tb + 3 * BEAT / 4, 0.09)
        # basse en croches
        for e in range(2):
            te = tb + e * BEAT / 2
            if te < DUR and not end_section and te >= 3.0 and not in_break:
                place(bass, bass_note(root + (12 if e == 1 else 0), BEAT / 2), te, 0.5)
        # arpège en croches
        for e in range(2):
            te = tb + e * BEAT / 2
            if te < 25.5 + BEAT:
                note = chord[ARP[(beat * 2 + e) % 8]] + 12
                place(keys, pluck(note), te, 0.28)
    place(pads, pad(chord, BAR + 0.3), t0, 0.22 if t0 < 25.5 else 0.3)

# écho léger sur l'arpège
d = int(BEAT * 0.75 * SR)
echo = np.zeros(N)
echo[d:] = keys[:-d] * 0.35
keys = keys + lp(echo, 3500)

# bruitages
for c in CUTS:
    place(sfx, whoosh(0.5, True), c - 0.28, 0.16)
place(sfx, whoosh(0.9, True), 0.0, 0.10)
place(sfx, impact(), 0.95, 0.55)           # « 0 % » qui tombe
place(sfx, impact(), 16.85, 0.35)          # « 50 % » qui se pose
for k in range(14):                        # compteur 0 → 50
    place(sfx, tick(), 15.0 + k * 0.13, 0.10)
place(sfx, chime([72, 76, 79, 84]), 25.55, 0.22)  # carte de fin

music = drums * 1.0 + bass * pump + keys * pump * 0.9 + pads * pump
music = hp(music, 30)

# ---------- voix ----------
vo = np.zeros(N)
for i, start in enumerate(VO_STARTS, 1):
    data, sr = sf.read(os.path.join(VO_DIR, f"l{i}.wav"), always_2d=True)
    data = data.mean(axis=1)
    if sr != SR:
        g = np.gcd(sr, SR)
        data = resample_poly(data, SR // g, sr // g)
    place(vo, data, start)
vo = hp(vo, 80)
meter = pyln.Meter(SR)
vo *= 10 ** ((-16 - meter.integrated_loudness(vo)) / 20)

# enveloppe de ducking lissée
win = int(0.03 * SR)
lvl = np.sqrt(np.convolve(vo ** 2, np.ones(win) / win, mode="same"))
active = (lvl > 10 ** (-40 / 20)).astype(float)
att, rel = int(0.04 * SR), int(0.35 * SR)
duck = np.zeros(N)
for i in range(1, N):  # suiveur attaque / relâche
    target = active[i]
    coef = 1 / att if target > duck[i - 1] else 1 / rel
    duck[i] = duck[i - 1] + (target - duck[i - 1]) * coef
music_gain = 1 - 0.55 * duck

music *= 10 ** ((-19 - meter.integrated_loudness(music)) / 20)
bed = music * music_gain + sfx * 0.8
fade = int(1.2 * SR)
bed[-fade:] *= np.linspace(1, 0, fade) ** 1.5

mix = vo + bed

# mise à niveau réseaux sociaux (~ -14 LUFS) avec limiteur à anticipation
lim = 10 ** (-1.0 / 20)
mix_gain = 10 ** ((-14 - meter.integrated_loudness(mix)) / 20)
need = np.minimum(1.0, lim / np.maximum(np.abs(mix * mix_gain), 1e-9))
need = minimum_filter1d(need, size=int(0.02 * SR))
k = np.hanning(int(0.01 * SR))
gain = mix_gain * np.convolve(need, k / k.sum(), mode="same")
vo, bed = vo * gain, bed * gain
mix = np.clip(vo + bed, -lim, lim)
loud = meter.integrated_loudness(mix)
peak = np.max(np.abs(mix))
scale = 1.0

os.makedirs(OUT, exist_ok=True)
sf.write(os.path.join(OUT, "vo.wav"), vo * scale, SR, subtype="PCM_16")
sf.write(os.path.join(OUT, "bed.wav"), bed * scale, SR, subtype="PCM_16")
sf.write(os.path.join(OUT, "mix.wav"), mix * scale, SR, subtype="PCM_16")
print(f"mix: {loud:.1f} LUFS, peak {20*np.log10(peak):.1f} dBFS")
