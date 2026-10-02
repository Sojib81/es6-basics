import { describe, expect, it } from "vitest";
import { renderTemplate, templateVariables } from "./render";

describe("renderTemplate", () => {
  it("fills known variables and blanks unknown ones", () => {
    expect(
      renderTemplate("Hi {name}, ref {ref}{missing}.", { name: "Jane", ref: "BK-ABC234" }),
    ).toBe("Hi Jane, ref BK-ABC234.");
  });

  it("never evaluates anything", () => {
    const vars = { name: "{ref}", ref: "X" };
    expect(renderTemplate("{name}", vars)).toBe("{ref}"); // no recursive expansion
    expect(renderTemplate("{constructor}|{toString}|${1+1}|{1abc}", {})).toBe("||${1+1}|{1abc}");
  });

  it("lists variables", () => {
    expect(templateVariables("{a} {b} {a}")).toEqual(["a", "b"]);
  });
});
