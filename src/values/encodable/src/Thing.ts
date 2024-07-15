import { SurrealTypeError } from "@tai-kun/surreal/errors";
import {
  BRACKET_L,
  BRACKET_R,
  escapeRid,
  MAX_I64,
  MIN_I64,
  quoteStr,
  toSurql,
} from "@tai-kun/surreal/utils";
import type { Table } from "@tai-kun/surreal/values";
import isPlainObject from "is-plain-obj";
import type { Encodable } from "../../_shared/types";
import Base, { type ThingId } from "../../decode-only/src/Thing";

export type * from "../../decode-only/src/Thing";

export default class Thing extends Base implements Encodable {
  /**
   * テーブル名をエスケープします。
   *
   * @param tb テーブル名またはテーブル。
   * @returns エスケープされたテーブル名。
   */
  static escapeTb(tb: string | Table): string {
    // SurrealDB では String を escape_rid でエスケープしている:
    // https://github.com/surrealdb/surrealdb/blob/v1.5.2/core/src/sql/thing.rs#L96

    if (typeof tb !== "string") {
      tb = tb.name;
    }

    return tb && escapeRid(tb) || (BRACKET_L + BRACKET_R);
  }

  /**
   * ID をエスケープします。64 ビットの範囲を超える `bigint` リテラルはエスケープされます。
   * 数値が NaN または Infinity の場合、エラーが発生します。
   *
   * @param id ID。
   * @returns エスケープされた ID。
   */
  static escapeId(id: ThingId): string {
    // Parser: https://github.com/surrealdb/surrealdb/blob/v1.5.2/core/src/syn/v2/parser/thing.rs#L227-L325
    // Formatter: https://github.com/surrealdb/surrealdb/blob/v1.5.2/core/src/sql/id.rs#L166-L178

    if (typeof id === "string") {
      // ID 生成関数
      if (id === "ulid()" || id === "uuid()" || id === "rand()") {
        return id;
      }

      if (id === "") {
        return BRACKET_L + BRACKET_R;
      }

      return escapeRid(id);
    }

    if (typeof id === "number") {
      // Number.MAX_VALUE などを許容するため、Number.isFinite で十分。
      if (!Number.isFinite(id)) {
        throw new SurrealTypeError("Invalid ID", { cause: id });
      }

      // 小数点や符号が無ければそのまま文字列にする。
      if (Number.isInteger(id) && id >= 0) {
        return id.toString(10);
      }

      return BRACKET_L + id.toString(10) + BRACKET_R;
    }

    if (typeof id === "bigint") {
      if (MIN_I64 <= id && id <= MAX_I64) {
        return id.toString(10);
      }

      return BRACKET_L + id.toString(10) + BRACKET_R;
    }

    if (
      Array.isArray(id)
      || (typeof id === "object" && typeof id.toSurql === "function")
      || isPlainObject(id)
    ) {
      return toSurql(id);
    }

    throw new SurrealTypeError("Invalid ID", { cause: id });
  }

  /**
   * @example
   * ```ts
   * const thing = new Thing("tb", {
   *   string: "あいうえお😢",
   *   number: [
   *     123,
   *     3.14,
   *   ],
   *   bigint: 9007199254740992n, // Number.MAX_SAFE_INTEGER + 1
   *   boolean: [
   *     true,
   *     false,
   *   ],
   *   null: null,
   *   undefined: undefined,
   *   date: new Date(0),
   * });
   * thing.toString();
   * // tb:{"bigint":9007199254740992,"boolean":[true,false],"date":d"1970-01-01T00:00:00.000Z","null":NULL,"number":[123,3.14],"string":s"あいうえお😢","undefined":NONE}
   * ```
   */
  toJSON(): string {
    return Thing.escapeTb(this.tb) + ":" + Thing.escapeId(this.id);
  }

  /**
   * @example
   * ```ts
   * const thing = new Thing("tb", {
   *   string: "あいうえお😢",
   *   number: [
   *     123,
   *     3.14,
   *   ],
   *   bigint: 9007199254740992n, // Number.MAX_SAFE_INTEGER + 1
   *   boolean: [
   *     true,
   *     false,
   *   ],
   *   null: null,
   *   undefined: undefined,
   *   date: new Date(0),
   * });
   * thing.toString();
   * // r"tb:{\"bigint\":9007199254740992,\"boolean\":[true,false],\"date\":d\"1970-01-01T00:00:00.000Z\",\"null\":NULL,\"number\":[123,3.14],\"string\":s\"あいうえお😢\",\"undefined\":NONE}"
   * ```
   */
  toSurql(): string {
    return "r" + quoteStr(this.toJSON());
  }

  structure(): {
    tb: string;
    id: ThingId;
  } {
    return {
      tb: this.tb,
      id: this.id,
    };
  }
}
