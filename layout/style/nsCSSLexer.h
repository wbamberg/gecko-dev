/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsCSSLexer_h___
#define nsCSSLexer_h___

#include "mozilla/UniquePtr.h"
#include "nsCSSScanner.h"
#include "nsICSSLexer.h"

class nsCSSLexer : public nsICSSLexer
{
 public:

  NS_DECL_ISUPPORTS
  NS_DECL_NSICSSLEXER

  nsCSSLexer(const nsAString&);

 private:

  virtual ~nsCSSLexer();

 private:

  nsString mInput;
  nsCSSScanner mScanner;
};

#endif /* nsCSSLexer_h___ */