"use client";

import Link from "next/link";
import { useState } from "react";
import { ROOMS, type Room, type RoomId } from "./rooms";
import styles from "./floor-plan.module.css";

const WALL = 10;

/** A door: a gap in the wall plus the swing arc, the way plans draw it. */
function Door({ x, y, size, rotate }: { x: number; y: number; size: number; rotate: number }) {
  return (
    <g className={styles.door} transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect fill="var(--paper)" height={WALL + 4} width={size} x={0} y={-(WALL + 4) / 2} />
      <path d={`M0 0 L0 ${-size} A${size} ${size} 0 0 1 ${size} 0`} />
    </g>
  );
}

function BillingFurniture() {
  // Two counters, one adapter: the payment interface drawn as furniture.
  return (
    <g aria-hidden="true" className={styles.furniture}>
      <rect height={44} rx={4} width={120} x={80} y={150} />
      <text x={140} y={177}>
        Mercado Pago
      </text>
      <rect height={44} rx={4} width={120} x={80} y={230} />
      <text x={140} y={257}>
        Polar
      </text>
      <path d="M200 172 H270 V252 H200 M270 212 H320" />
      <rect className={styles.adapter} height={64} rx={32} width={120} x={320} y={180} />
      <text className={styles.adapterText} x={380} y={216}>
        1 interfaz
      </text>
    </g>
  );
}

const SEATS = [
  [760, 175],
  [820, 175],
  [880, 175],
  [760, 285],
  [820, 285],
  [880, 285],
] as const;

const SHELVES = ["AGENTS.md", "CONTEXT.md", "7 ADR", "llms-full.txt"] as const;

/** Furniture that says what each room holds: a team table, shelves, a breaker panel. */
function RoomFurniture() {
  return (
    <g aria-hidden="true" className={styles.furniture}>
      {/* Equipos: one table, many seats. */}
      <rect height={60} rx={6} width={170} x={735} y={200} />
      {SEATS.map(([cx, cy]) => (
        <circle cx={cx} cy={cy} key={`${cx}-${cy}`} r={12} />
      ))}

      {/* Biblioteca: shelves along the wall. */}
      {SHELVES.map((label, index) => (
        <g key={label}>
          <rect height={30} width={200} x={70} y={430 + index * 36} />
          <text x={170} y={450 + index * 36}>
            {label}
          </text>
        </g>
      ))}

      {/* Idiomas: two signs. */}
      <rect height={44} rx={22} width={70} x={320} y={450} />
      <text x={355} y={477}>
        en
      </text>
      <rect height={44} rx={22} width={70} x={400} y={450} />
      <text x={435} y={477}>
        es
      </text>
      <text className={styles.furnitureSmall} x={390} y={530}>
        con vos
      </text>

      {/* Tablero: a breaker panel, every switch on. */}
      <rect height={130} width={130} x={515} y={430} />
      {Array.from({ length: 12 }, (_, index) => (
        <rect
          className={styles.breaker}
          height={22}
          key={`breaker-${index}`}
          width={14}
          x={530 + (index % 6) * 18}
          y={448 + Math.floor(index / 6) * 50}
        />
      ))}
      <text className={styles.furnitureSmall} x={580} y={545}>
        todo en verde
      </text>
    </g>
  );
}

function RoomShape({
  room,
  active,
  onSelect,
}: {
  room: Room;
  active: boolean;
  onSelect: (id: RoomId) => void;
}) {
  const cx = room.x + room.w / 2;
  const isYours = room.id === "yours";
  return (
    <g
      aria-label={`${room.name}: ${room.note}`}
      aria-pressed={active}
      className={styles.room}
      data-active={active || undefined}
      data-yours={isYours || undefined}
      onClick={() => onSelect(room.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(room.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <rect
        className={styles.roomFill}
        fill={isYours ? "url(#hatch)" : undefined}
        height={room.h}
        width={room.w}
        x={room.x}
        y={room.y}
      />
      <text className={styles.roomName} textAnchor="middle" x={cx} y={room.y + 50}>
        {room.name}
      </text>
      <text className={styles.roomNote} textAnchor="middle" x={cx} y={room.y + 76}>
        {room.note}
      </text>
    </g>
  );
}

/** The hero drawing: the starter as a house in obra gris. Each room opens its details. */
export function FloorPlan() {
  const [activeId, setActiveId] = useState<RoomId>("billing");
  const active = ROOMS.find((room) => room.id === activeId) ?? ROOMS[0];

  return (
    <div className={styles.planWrap}>
      <div className={styles.sheet}>
        <svg
          aria-label="Plano de Beztack. Elegí una pieza para ver qué trae."
          className={styles.plan}
          role="group"
          viewBox="0 0 1000 668"
        >
          <defs>
            <pattern
              height="14"
              id="hatch"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
              width="14"
            >
              <line className={styles.hatchLine} x1="0" x2="0" y1="0" y2="14" />
            </pattern>
          </defs>

          {/* Dimension line: the whole monorepo along the top. */}
          <g aria-hidden="true" className={styles.dimension}>
            <path d="M40 18 H960 M40 10 V26 M960 10 V26" />
            <text textAnchor="middle" x={500} y={12}>
              apps: ui (Vite + React), api (Nitro), docs (Next.js)
            </text>
          </g>

          {ROOMS.map((room) => (
            <RoomShape
              active={room.id === activeId}
              key={room.id}
              onSelect={setActiveId}
              room={room}
            />
          ))}

          <BillingFurniture />
          <RoomFurniture />

          {/* Walls drawn last so they sit on top of the room fills. */}
          <g aria-hidden="true" className={styles.walls}>
            <rect height={540} width={920} x={40} y={40} />
            <path d="M480 40 V580 M680 40 V580 M40 330 H960 M480 200 H680 M300 330 V580" />
          </g>

          <g aria-hidden="true">
            <Door rotate={180} size={56} x={676} y={40} />
            <Door rotate={0} size={44} x={540} y={200} />
            <Door rotate={90} size={44} x={480} y={150} />
            <Door rotate={90} size={44} x={680} y={240} />
            <Door rotate={0} size={44} x={130} y={330} />
            <Door rotate={0} size={44} x={360} y={330} />
            <Door rotate={0} size={44} x={560} y={330} />
            <Door rotate={0} size={44} x={900} y={330} />
          </g>

          {/* Bottom dimension: the packages under everything. */}
          <g aria-hidden="true" className={styles.dimension}>
            <path d="M40 612 H700 M40 604 V620 M700 604 V620" />
            <text textAnchor="middle" x={370} y={644}>
              packages: auth, db, email, env, payments, state, ai, ocr, cli
            </text>
          </g>
          {/* Title block, bottom right, as on any drawing sheet. */}
          <g aria-hidden="true" className={styles.titleBlock}>
            <rect height={64} width={240} x={720} y={594} />
            <path d="M720 626 H960 M800 594 V658" />
            <text className={styles.titleKey} x={730} y={615}>
              Proyecto
            </text>
            <text className={styles.titleValue} x={810} y={615}>
              Beztack, plano A-01
            </text>
            <text className={styles.titleKey} x={730} y={647}>
              Estado
            </text>
            <text className={styles.titleValue} x={810} y={647}>
              Obra gris, MIT
            </text>
          </g>
        </svg>
      </div>

      <section aria-live="polite" className={styles.panel} key={active.id}>
        <p className={styles.panelNote}>{active.note}</p>
        <h2 className={styles.panelName}>{active.name}</h2>
        <p className={styles.panelSummary}>{active.summary}</p>
        {active.items.length > 0 ? (
          <ul className={styles.panelList}>
            {active.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {active.link ? (
          <Link className={styles.panelLink} href={active.link.href}>
            {active.link.label}
          </Link>
        ) : null}
        <nav aria-label="Piezas" className={styles.roomTabs}>
          {ROOMS.map((room) => (
            <button
              aria-pressed={room.id === activeId}
              className={styles.roomTab}
              key={room.id}
              onClick={() => setActiveId(room.id)}
              type="button"
            >
              {room.name}
            </button>
          ))}
        </nav>
      </section>
    </div>
  );
}
