/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCSSLexer.h"
#include "js/Value.h"
#include "mozilla/dom/CSSTokenBinding.h"
#include "mozilla/dom/ToJSValue.h"

NS_IMPL_ISUPPORTS(nsCSSLexer, nsICSSLexer)

nsCSSLexer::nsCSSLexer(const nsAString& aText)
  : mInput(aText)
  , mScanner(mInput, 1)
{
}

nsCSSLexer::~nsCSSLexer()
{
}

/* unsigned long getLineNumber (); */
nsresult
nsCSSLexer::GetLineNumber(uint32_t *result)
{
  // The scanner uses 1-based line numbers, but our callers expect
  // 0-based.
  *result = mScanner.GetLineNumber() - 1;
  return NS_OK;
}

/* unsigned long getColumnNumber (); */
nsresult
nsCSSLexer::GetColumnNumber(uint32_t *result)
{
  *result = mScanner.GetColumnNumber();
  return NS_OK;
}

/* [implicit_jscontext] jsval nextToken (); */
nsresult
nsCSSLexer::NextToken (JSContext* aCx, JS::MutableHandle<JS::Value> aToken)
{
  nsCSSToken token;
  if (!mScanner.Next(token, eCSSScannerExclude_none)) {
    aToken.set(JS::UndefinedValue());
    return NS_OK;
  }

  mozilla::dom::CSSToken resultToken;

  resultToken.mTokenType = static_cast<mozilla::dom::CSSTokenType>(token.mType);
  resultToken.mStartOffset = mScanner.GetTokenOffset();
  resultToken.mEndOffset = mScanner.GetTokenEndOffset();

  switch (token.mType) {
  case eCSSToken_Whitespace:
    break;

  case eCSSToken_Ident:
  case eCSSToken_Function:
  case eCSSToken_AtKeyword:
  case eCSSToken_ID:
  case eCSSToken_Hash:
    resultToken.mText.Construct(token.mIdent);
    break;

  case eCSSToken_Dimension:
    resultToken.mText.Construct(token.mIdent);
    /* FALLTHROUGH */
  case eCSSToken_Number:
  case eCSSToken_Percentage:
    resultToken.mNumber.Construct(token.mNumber);
    resultToken.mHasSign.Construct(token.mHasSign);
    resultToken.mIsInteger.Construct(token.mIntegerValid);
    break;

  case eCSSToken_String:
  case eCSSToken_Bad_String:
  case eCSSToken_URL:
  case eCSSToken_Bad_URL:
    resultToken.mText.Construct(token.mIdent);
    /* Don't bother emitting the delimiter, as it is readily extracted
       from the source string when needed.  */
    break;

  case eCSSToken_Symbol:
    resultToken.mText.Construct(nsString(&token.mSymbol, 1));
    break;

  case eCSSToken_Includes:
  case eCSSToken_Dashmatch:
  case eCSSToken_Beginsmatch:
  case eCSSToken_Endsmatch:
  case eCSSToken_Containsmatch:
    break;

  case eCSSToken_URange:
    resultToken.mText.Construct(token.mIdent);
    break;

  case eCSSToken_Comment:
  case eCSSToken_HTMLComment:
    /* The comment text is easily extracted from the source string,
       and is rarely useful.  */
    break;
  }

  if (!ToJSValue(aCx, resultToken, aToken)) {
    JS_ClearPendingException(aCx);
    return NS_ERROR_UNEXPECTED;
  }

  return NS_OK;
}