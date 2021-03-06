/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/*
 * validateChain.c
 *
 * Tests Cert Chain Validation
 *
 */

#include <stdio.h>
#include <string.h>
#include <stddef.h>

#include "pkix_pl_generalname.h"
#include "pkix_pl_cert.h"
#include "pkix.h"
#include "testutil.h"
#include "prlong.h"
#include "plstr.h"
#include "prthread.h"
#include "nspr.h"
#include "prtypes.h"
#include "prtime.h"
#include "pk11func.h"
#include "secasn1.h"
#include "cert.h"
#include "cryptohi.h"
#include "secoid.h"
#include "certdb.h"
#include "secitem.h"
#include "keythi.h"
#include "nss.h"

static void *plContext = NULL;

static 
void printUsage(void){
        (void) printf("\nUSAGE:\tvalidateChain <trustedCert> "
                "<cert_1> <cert_2> ... <cert_n>\n");
        (void) printf("\tValidates a chain of n certificates "
                "using the given trust anchor.\n");

}

static PKIX_PL_Cert *
createCert(char *inFileName)
{
        PKIX_PL_ByteArray *byteArray = NULL;
        void *buf = NULL;
        PRFileDesc *inFile = NULL;
        PKIX_UInt32 len;
        SECItem certDER;
        SECStatus rv;
        /* default: NULL cert (failure case) */
        PKIX_PL_Cert *cert = NULL;

        PKIX_TEST_STD_VARS();

        certDER.data = NULL;

        inFile = PR_Open(inFileName, PR_RDONLY, 0);

        if (!inFile){
                pkixTestErrorMsg = "Unable to open cert file";
                goto cleanup;
        } else {
                rv = SECU_ReadDERFromFile(&certDER, inFile, PR_FALSE, PR_FALSE);
                if (!rv){
                        buf = (void *)certDER.data;
                        len = certDER.len;

                        PKIX_TEST_EXPECT_NO_ERROR
                                (PKIX_PL_ByteArray_Create
                                (buf, len, &byteArray, plContext));

                        PKIX_TEST_EXPECT_NO_ERROR(PKIX_PL_Cert_Create
                                                (byteArray, &cert, plContext));

                        SECITEM_FreeItem(&certDER, PR_FALSE);
                } else {
                        pkixTestErrorMsg = "Unable to read DER from cert file";
                        goto cleanup;
                }
        }

cleanup:

        if (inFile){
                PR_Close(inFile);
        }

        if (PKIX_TEST_ERROR_RECEIVED){
                SECITEM_FreeItem(&certDER, PR_FALSE);
        }

        PKIX_TEST_DECREF_AC(byteArray);

        PKIX_TEST_RETURN();

        return (cert);
}

int validate_chain(int argc, char *argv[])
{
        PKIX_TrustAnchor *anchor = NULL;
        PKIX_List *anchors = NULL;
        PKIX_List *certs = NULL;
        PKIX_ProcessingParams *procParams = NULL;
        PKIX_ValidateParams *valParams = NULL;
        PKIX_ValidateResult *valResult = NULL;
        PKIX_PL_X500Name *subject = NULL;
        PKIX_ComCertSelParams *certSelParams = NULL;
        PKIX_CertSelector *certSelector = NULL;
	PKIX_VerifyNode *verifyTree = NULL;
	PKIX_PL_String *verifyString = NULL;

        char *trustedCertFile = NULL;
        char *chainCertFile = NULL;
        PKIX_PL_Cert *trustedCert = NULL;
        PKIX_PL_Cert *chainCert = NULL;
        PKIX_UInt32 chainLength = 0;
        PKIX_UInt32 i = 0;
        PKIX_UInt32 j = 0;
        PKIX_UInt32 actualMinorVersion;

        PKIX_TEST_STD_VARS();

        if (argc < 3){
                printUsage();
                return (0);
        }

        PKIX_TEST_EXPECT_NO_ERROR(
            PKIX_PL_NssContext_Create(0, PKIX_FALSE, NULL, &plContext));

        chainLength = (argc - j) - 2;

        /* create processing params with list of trust anchors */
        trustedCertFile = argv[1+j];
        trustedCert = createCert(trustedCertFile);

        PKIX_TEST_EXPECT_NO_ERROR
                (PKIX_PL_Cert_GetSubject(trustedCert, &subject, plContext));

        PKIX_TEST_EXPECT_NO_ERROR
                (PKIX_ComCertSelParams_Create(&certSelParams, plContext));

#if 0
        PKIX_TEST_EXPECT_NO_ERROR(PKIX_ComCertSelParams_SetSubject
                                    (certSelParams, subject, plContext));
#endif

        PKIX_TEST_EXPECT_NO_ERROR
                (PKIX_CertSelector_Create
                (NULL, NULL, &certSelector, plContext));

        PKIX_TEST_EXPECT_NO_ERROR(PKIX_CertSelector_SetCommonCertSelectorParams
                                (certSelector, certSelParams, plContext));

        PKIX_TEST_DECREF_BC(subject);
        PKIX_TEST_DECREF_BC(certSelParams);

        PKIX_TEST_EXPECT_NO_ERROR(PKIX_TrustAnchor_CreateWithCert
                                    (trustedCert, &anchor, plContext));

        PKIX_TEST_EXPECT_NO_ERROR(PKIX_List_Create(&anchors, plContext));
        PKIX_TEST_EXPECT_NO_ERROR
                (PKIX_List_AppendItem
                (anchors, (PKIX_PL_Object *)anchor, plContext));
        PKIX_TEST_EXPECT_NO_ERROR(PKIX_ProcessingParams_Create
                                    (anchors, &procParams, plContext));

        PKIX_TEST_EXPECT_NO_ERROR
                (PKIX_ProcessingParams_SetTargetCertConstraints
                (procParams, certSelector, plContext));

        PKIX_TEST_DECREF_BC(certSelector);

        /* create cert chain */
        PKIX_TEST_EXPECT_NO_ERROR(PKIX_List_Create(&certs, plContext));
        for (i = 0; i < chainLength; i++){
                chainCertFile = argv[(i + j) + 2];
                chainCert = createCert(chainCertFile);

                PKIX_TEST_EXPECT_NO_ERROR(PKIX_List_AppendItem
                                            (certs,
                                            (PKIX_PL_Object *)chainCert,
                                            plContext));

                PKIX_TEST_DECREF_BC(chainCert);
                chainCert = NULL;
        }
        /* create validate params with processing params and cert chain */
        PKIX_TEST_EXPECT_NO_ERROR(PKIX_ValidateParams_Create
                                    (procParams, certs, &valParams, plContext));

        PKIX_TEST_DECREF_BC(trustedCert); trustedCert = NULL;
        PKIX_TEST_DECREF_BC(anchor); anchor = NULL;
        PKIX_TEST_DECREF_BC(anchors); anchors = NULL;
        PKIX_TEST_DECREF_BC(certs); certs = NULL;
        PKIX_TEST_DECREF_BC(procParams); procParams = NULL;

        /* validate cert chain using processing params and return valResult */

        PKIX_TEST_EXPECT_NO_ERROR
                (PKIX_ValidateChain(valParams, &valResult, &verifyTree, plContext));

        if (valResult != NULL){
                (void) printf("SUCCESSFULLY VALIDATED\n");
        }

cleanup:

        if (PKIX_TEST_ERROR_RECEIVED){
                (void) printf("FAILED TO VALIDATE\n");
	        (void) PKIX_PL_Object_ToString
        	        ((PKIX_PL_Object*)verifyTree, &verifyString, plContext);
	        (void) printf("verifyTree is\n%s\n", verifyString->escAsciiString);
	        PKIX_TEST_DECREF_AC(verifyString);

        }

        PKIX_TEST_DECREF_AC(verifyTree);
        PKIX_TEST_DECREF_AC(valResult);
        PKIX_TEST_DECREF_AC(valParams);

        PKIX_TEST_RETURN();

        PKIX_Shutdown(plContext);

        return (0);

}
