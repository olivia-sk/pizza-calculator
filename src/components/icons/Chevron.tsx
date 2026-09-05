import { SVGProps } from "react";

/**
 * The chevrons used for up/down value controls.
 *
 * These render the artwork in `src/assets/icons/chevron-{up,down}.svg`. The
 * paths are inlined rather than imported so they can be recolored through
 * `currentColor` and sized by the caller: an <img> of an SVG cannot inherit
 * text color, which would leave a black chevron invisible in dark mode.
 *
 * They are filled shapes rather than strokes, so they are sized by `size`
 * alone; there is no stroke width to match against neighbouring text.
 */

interface ChevronProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
}

function Chevron({ size = 24, d, ...props }: ChevronProps & { d: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d={d} fill="currentColor" />
    </svg>
  );
}

const UP_PATH =
  "M12 7C12.2652 7 12.5196 7.10536 12.7071 7.29289L19.7071 14.2929C20.0976 14.6834 20.0976 15.3166 19.7071 15.7071C19.3166 16.0976 18.6834 16.0976 18.2929 15.7071L12 9.41421L5.70711 15.7071C5.31658 16.0976 4.68342 16.0976 4.29289 15.7071C3.90237 15.3166 3.90237 14.6834 4.29289 14.2929L11.2929 7.29289C11.4804 7.10536 11.7348 7 12 7Z";

const DOWN_PATH =
  "M4.29289 8.29289C4.68342 7.90237 5.31658 7.90237 5.70711 8.29289L12 14.5858L18.2929 8.29289C18.6834 7.90237 19.3166 7.90237 19.7071 8.29289C20.0976 8.68342 20.0976 9.31658 19.7071 9.70711L12.7071 16.7071C12.3166 17.0976 11.6834 17.0976 11.2929 16.7071L4.29289 9.70711C3.90237 9.31658 3.90237 8.68342 4.29289 8.29289Z";

export function ChevronUpIcon(props: ChevronProps) {
  return <Chevron {...props} d={UP_PATH} />;
}

export function ChevronDownIcon(props: ChevronProps) {
  return <Chevron {...props} d={DOWN_PATH} />;
}
