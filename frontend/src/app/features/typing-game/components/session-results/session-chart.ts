export interface ChartSample {
  second: number;
  wpm: number;
  height_percent: number;
}

export interface PlotPoint extends ChartSample { x: number; y: number; }

// Presentation geometry only: scores and samples come from the backend.
export function sessionChart(samples: ChartSample[], elapsed: number) {
  const points: PlotPoint[] = samples.map(sample => ({
    ...sample,
    x: Math.round(Math.min(1, Math.max(0, sample.second / Math.max(elapsed, .01))) * 1000),
    y: Math.round((1 - Math.min(100, Math.max(0, sample.height_percent)) / 100) * 200),
  }));
  const line = points.map(point => `${point.x},${point.y}`).join(' ');
  const first = points[0], last = points.at(-1);
  return {
    points, line,
    area: first && last && points.length > 1
      ? `${first.x},200 ${line} ${last.x},200` : '',
    maximum: Math.max(10, ...samples.map(sample => sample.wpm)),
  };
}
