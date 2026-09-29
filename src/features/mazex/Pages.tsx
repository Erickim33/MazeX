import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { GameSettings } from "./storage";

function Page({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <main className="page">
      <div className="page-card animate-fade-in">
        <Button variant="ghost" className="justify-self-start" onClick={onBack}><ArrowLeft size={17} /> Back</Button>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function HelpPage({ onBack }: { onBack: () => void }) {
  return (
    <Page title="How to play" onBack={onBack}>
      <section><h2>Goal</h2><p>Reach the glowing green exit before the red Hunter catches you. Every maze is new, and the Hunter gets faster as you level up. It stays hidden for the first 5 seconds, then appears at a random spot far from you and starts chasing.</p></section>
      <section>
        <h2>Controls</h2>
        <ul>
          <li>Move: <kbd>W A S D</kbd> or the arrow keys, or the joystick on touch screens.</li>
          <li>Dash: <kbd>Space</kbd> or the lightning button. A burst of speed, then a 4 second cooldown.</li>
          <li>Hint: <kbd>H</kbd> or the lightbulb button.</li>
          <li>Pause: <kbd>P</kbd>, <kbd>Esc</kbd> or the pause button. The game also pauses when you leave the tab.</li>
          <li>Mini map: the map button shows where you, the exit and the Hunter are.</li>
        </ul>
      </section>
      <section><h2>Hints</h2><p>A hint draws the shortest route to the exit for a few seconds. You get 3 per maze, and each one takes 100 points off that maze&apos;s bonus.</p></section>
      <section><h2>Lives and score</h2><p>You have 3 lives. Getting caught costs one and restarts the maze. Faster escapes and higher mazes score more. Your run saves automatically, so Continue on the main menu picks up at your current maze.</p></section>
      <section>
        <h2>Tips</h2>
        <ul>
          <li>Save your dash for corners and dead ends.</li>
          <li>When &quot;Hunter close&quot; appears, keep moving.</li>
          <li>Use hints when you are lost, not at the start.</li>
        </ul>
      </section>
    </Page>
  );
}

type SettingsPageProps = {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  hasSave: boolean;
  onReset: () => void;
  onBack: () => void;
};

export function SettingsPage({ settings, onChange, hasSave, onReset, onBack }: SettingsPageProps) {
  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => onChange({ ...settings, [key]: value });
  return (
    <Page title="Settings" onBack={onBack}>
      <section>
        <label className="setting-row">Sound effects <Switch checked={settings.sound} onCheckedChange={(value: boolean) => set("sound", value)} /></label>
        <label className="setting-row">Volume <Slider className="w-32" min={0} max={100} step={5} disabled={!settings.sound} value={[Math.round(settings.volume * 100)]} onValueChange={([value]: number[]) => set("volume", (value ?? 0) / 100)} /></label>
        <label className="setting-row">Vibration <Switch checked={settings.vibration} onCheckedChange={(value: boolean) => set("vibration", value)} /></label>
        <label className="setting-row">Mini map on start <Switch checked={settings.miniMap} onCheckedChange={(value: boolean) => set("miniMap", value)} /></label>
        <label className="setting-row">Hints <Switch checked={settings.hints} onCheckedChange={(value: boolean) => set("hints", value)} /></label>
      </section>
      <section>
        <h2>Saved run</h2>
        <p>{hasSave ? "Your progress is saved on this device." : "No saved run yet."}</p>
        <Button variant="outline" disabled={!hasSave} onClick={onReset}>Delete saved run</Button>
      </section>
    </Page>
  );
}

export function MultiplayerPage({ onBack }: { onBack: () => void }) {
  return (
    <Page title="Multiplayer" onBack={onBack}>
      <section>
        <h2>Play with friends</h2>
        <p>Create a room and invite other players with a room code.</p>
      </section>

      <section className="grid gap-3">
        <Button className="w-full">Create Room</Button>
        <Button className="w-full" variant="outline">Join Room</Button>
      </section>

      <section>
        <p className="text-sm opacity-70">Online multiplayer is being prepared.</p>
      </section>
    </Page>
  );
}
