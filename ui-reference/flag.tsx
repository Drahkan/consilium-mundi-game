import type { FlagShape, FlagSpec } from "@/lib/game/types";
import { cn } from "@/lib/utils";

function Shape({ shape, fill }: { shape: FlagShape; fill: string }) {
  switch (shape) {
    case "disc":
      return <circle cx="0" cy="0" r="12" fill={fill} />;
    case "ring":
      return (
        <circle cx="0" cy="0" r="12" fill="none" stroke={fill} strokeWidth="4" />
      );
    case "diamond":
      return <polygon points="0,-14 12,0 0,14 -12,0" fill={fill} />;
    case "chevron":
      return <polygon points="-14,-10 0,6 14,-10 14,-2 0,14 -14,-2" fill={fill} />;
    case "bar":
      return <rect x="-16" y="-5" width="32" height="10" fill={fill} />;
    case "cross":
      return (
        <g fill={fill}>
          <rect x="-3.5" y="-14" width="7" height="28" />
          <rect x="-14" y="-3.5" width="28" height="7" />
        </g>
      );
    case "saltire":
      return (
        <g fill={fill} transform="rotate(45)">
          <rect x="-3.5" y="-16" width="7" height="32" />
          <rect x="-16" y="-3.5" width="32" height="7" />
        </g>
      );
    case "triangle":
      return <polygon points="0,-14 14,12 -14,12" fill={fill} />;
    case "star":
      return (
        <polygon
          fill={fill}
          points="0,-14 3.2,-4.4 13.3,-4.4 5.1,1.6 8.2,11.4 0,5.2 -8.2,11.4 -5.1,1.6 -13.3,-4.4 -3.2,-4.4"
        />
      );
    case "hex":
      return (
        <polygon points="12,0 6,10.4 -6,10.4 -12,0 -6,-10.4 6,-10.4" fill={fill} />
      );
    case "crescent":
      return (
        <path
          fill={fill}
          d="M4-12a13 13 0 1 0 0 24 10 10 0 1 1 0-24z"
        />
      );
    case "slash":
      return (
        <rect
          x="-18"
          y="-3"
          width="36"
          height="6"
          fill={fill}
          transform="rotate(-32)"
        />
      );
  }
}

export function FlagMark({
  spec,
  className,
}: {
  spec: FlagSpec;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 60 36"
      className={cn("block overflow-hidden rounded-[2px]", className)}
      aria-hidden
    >
      <rect width="60" height="36" fill={spec.colors[0]} />
      <g
        transform={`translate(${30 + spec.offsetA.x * 16}, ${18 + spec.offsetA.y * 8}) scale(${spec.scaleA})`}
      >
        <Shape shape={spec.shapeA} fill={spec.colors[1]} />
      </g>
      <g
        transform={`translate(${30 + spec.offsetB.x * 16}, ${18 + spec.offsetB.y * 8}) scale(${spec.scaleB})`}
      >
        <Shape shape={spec.shapeB} fill={spec.colors[2]} />
      </g>
    </svg>
  );
}
