export interface CalculatorRequest {
  characters: string;
  seconds: string;
  errors: string;
}

export interface CalculatorResult {
  characters: number;
  seconds: number;
  errors: number;
  gross_wpm: number;
  adjusted_wpm: number;
  accuracy: number;
}
