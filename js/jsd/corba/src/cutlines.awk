# -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
#
# The contents of this file are subject to the Netscape Public License
# Version 1.0 (the "NPL"); you may not use this file except in
# compliance with the NPL.  You may obtain a copy of the NPL at
# http://www.mozilla.org/NPL/
#
# Software distributed under the NPL is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the NPL
# for the specific language governing rights and limitations under the
# NPL.
#
# The Initial Developer of this code under the NPL is Netscape
# Communications Corporation.  Portions created by Netscape are
# Copyright (C) 1998 Netscape Communications Corporation.  All Rights
# Reserved.

#
# see usage...
#

BEGIN {
    skiplines_left = 0
    if( 0 == lines || 0 == pat )
    {
# show usage...        
        print "\n"
        print "strips some lines when first line contains pattern\n"
        print "\tusage -v pat=\"pattern\" -v lines=3"
    }
}

{
    if( skiplines_left )
        skiplines_left--;
    else
    {
        if( match($0, pat) != 0 )
            skiplines_left = lines-1;
        else
            print $0;
    }
}
