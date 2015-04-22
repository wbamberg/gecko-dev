/* -*- Mode: IDL; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// The possible values for CSSToken.tokenType.
enum CSSTokenType {
  // Whitespace.
  "WHITESPACE",
  // A CSS comment.
  "COMMENT",
  // An identifier.  |text| holds the identifier text.
  "IDENT",
  // A function token.  |text| holds the function name.  Note that the
  // function token includes (i.e., consumes) the "(" -- but this is
  // not included in |text|.
  "FUNCTION",
  // "@word".  |text| holds "word", without the "@".
  "AT",
  // "#word".  |text| holds "word", without the "#".
  "ID",
  // "#word".  ID is used when "word" would have been a valid IDENT
  // token without the "#"; otherwise, HASH is used.
  "HASH",
  // A number.
  "NUMBER",
  // A dimensioned number.
  "DIMENSION",
  // A percentage.
  "PERCENTAGE",
  // A string.
  "STRING",
  // A "bad string".  This can only be returned when a string is
  // unterminated at EOF.  (However, currently the lexer returns
  // ordinary STRING tokens in this situation.)
  "BAD_STRING",
  // A URL.  |text| holds the URL.
  "URL",
  // A "bad URL".  This is a URL that is unterminated at EOF.  |text|
  // holds the URL.
  "BAD_URL",
  // A "SYMBOL" is any one-character symbol.  This corresponds to the
  // DELIM token in the CSS specification.
  "SYMBOL",
  // The "~=" token.
  "INCLUDES",
  // The "|=" token.
  "DASHMATCH",
  // The "^=" token.
  "BEGINSMATCH",
  // The "$=" token.
  "ENDSMATCH",
  // The "*=" token.
  "CONTAINSMATCH",
  // A unicode-range token.  This is currently not fully represented
  // by CSSToken.
  "URANGE",
  // HTML comment delimiters, either "<!--" or "-->".  Note that each
  // is emitted as a separate token, and the intervening text is lexed
  // as normal; whereas ordinary CSS comments are lexed as a unit.
  "HTMLCOMMENT"
};

dictionary CSSToken {
  // The token type.
  CSSTokenType tokenType = "WHITESPACE";

  // Offset of the first character of the token.
  unsigned long startOffset = 0;
  // Offset of the character after the final character of the token.
  // This is chosen so that the offsets can be passed to |substring|
  // to yield the exact contents of the token.
  unsigned long endOffset = 0;

  // If the token is a number, this holds the value.
  double number;
  // True iff the number had an explicit sign.
  boolean hasSign;
  // True iff the number was specified as an integer.
  boolean isInteger;

  // Text associated with the token.  For identifiers, the
  // identifier. For strings, the contents.  For numbers, a dimension.
  DOMString text;
};