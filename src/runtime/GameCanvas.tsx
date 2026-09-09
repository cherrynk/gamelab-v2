"use client";

import { useEffect, useRef } from "react";
import { artFolderFor } from "@/art/mapStyle";
import { setActiveArtStyle } from "@/art/runtime";
import type { GameSpec } from "@/core/spec";

type GameCanvasProps = {
  spec: GameSpec;
  running?: boolean;
};

export default function GameCanvas({ spec, running = true }: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !running) return;

    let game: import("phaser").Game | undefined;
    let cancelled = false;

    const start = async () => {
      const [{ default: Phaser }, { sceneFor }] = await Promise.all([
        import("phaser"),
        import("./createScene"),
      ]);
      if (cancelled || !hostRef.current) return;
      const Scene = sceneFor(spec);

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: 960,
        height: 540,
        backgroundColor: spec.style.background,
        audio: { noAudio: true },
        render: { pixelArt: spec.style.pixelArt, antialias: !spec.style.pixelArt },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        callbacks: {
          preBoot: (boot) => {
            boot.registry.set("spec", spec);
            setActiveArtStyle(artFolderFor(spec.style.id));
          },
        },
        scene: [Scene],
      });
      if (hostRef.current) Object.assign(hostRef.current, { __phaser: game });
    };

    void start();

    return () => {
      cancelled = true;
      game?.destroy(true);
      game = undefined;
    };
  }, [spec, running]);

  return (
    <div
      ref={hostRef}
      role="application"
      aria-label="游戏预览"
      className="aspect-video w-full overflow-hidden rounded-2xl border border-line bg-black"
    />
  );
}
